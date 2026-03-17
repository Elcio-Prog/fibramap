import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

type ColumnMeta = {
  table_name: string;
  column_name: string;
  formatted_type: string;
  is_nullable: boolean;
  default_expr: string | null;
  ordinal_position: number;
};

type ConstraintMeta = {
  table_name: string;
  conname: string;
  contype: string;
  definition: string;
};

type FunctionMeta = {
  proname: string;
  definition: string;
};

type PolicyMeta = {
  tablename: string;
  policyname: string;
  permissive: string;
  roles_sql: string;
  cmd: string;
  qual: string | null;
  with_check: string | null;
};

type RlsMeta = {
  table_name: string;
  relrowsecurity: boolean;
};

const ALLOWED_ORIGINS = [
  "https://fibramap.lovable.app",
  "https://id-preview--0e81b9c8-14a6-450d-b23b-484015b8a5a5.lovable.app",
  "https://0e81b9c8-14a6-450d-b23b-484015b8a5a5.lovableproject.com",
];

const BATCH_SIZE = 250;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

function qident(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function qliteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function formatColumn(column: ColumnMeta) {
  const pieces = [qident(column.column_name), column.formatted_type];

  if (column.default_expr) {
    pieces.push(`default ${column.default_expr}`);
  }

  if (!column.is_nullable) {
    pieces.push("not null");
  }

  return pieces.join(" ");
}

function buildCreatePolicySql(policy: PolicyMeta) {
  const segments = [
    `create policy ${qident(policy.policyname)}`,
    `on public.${qident(policy.tablename)}`,
    `as ${policy.permissive.toLowerCase()}`,
    `for ${policy.cmd.toLowerCase()}`,
    `to ${policy.roles_sql || "public"}`,
  ];

  if (policy.qual) {
    segments.push(`using (${policy.qual})`);
  }

  if (policy.with_check) {
    segments.push(`with check (${policy.with_check})`);
  }

  return `${segments.join("\n  ")};`;
}

function toTimestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function gzipText(text: string) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).arrayBuffer();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let dbClient: Client | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await supabaseClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .eq("is_active", true)
      .single();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Sem permissão de administrador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const schemaOnly = url.searchParams.get("schemaOnly") === "true";
    const shouldGzip = !schemaOnly && url.searchParams.get("gzip") !== "false";

    dbClient = new Client(dbUrl);
    await dbClient.connect();

    const [{ rows: tableRows }, { rows: columnRows }, { rows: constraintRows }, { rows: enumRows }, { rows: functionRows }, { rows: policyRows }, { rows: rlsRows }] = await Promise.all([
      dbClient.queryObject<{ table_name: string }>(`
        select c.relname as table_name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
        order by c.relname;
      `),
      dbClient.queryObject<ColumnMeta>(`
        select
          c.relname as table_name,
          a.attname as column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) as formatted_type,
          not a.attnotnull as is_nullable,
          pg_get_expr(ad.adbin, ad.adrelid) as default_expr,
          a.attnum as ordinal_position
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
        where n.nspname = 'public'
          and c.relkind = 'r'
          and a.attnum > 0
          and not a.attisdropped
        order by c.relname, a.attnum;
      `),
      dbClient.queryObject<ConstraintMeta>(`
        select
          cl.relname as table_name,
          c.conname,
          c.contype,
          pg_get_constraintdef(c.oid) as definition
        from pg_constraint c
        join pg_class cl on cl.oid = c.conrelid
        join pg_namespace n on n.oid = cl.relnamespace
        where n.nspname = 'public'
          and c.contype in ('p', 'u', 'f', 'c')
        order by cl.relname, c.contype, c.conname;
      `),
      dbClient.queryObject<{ enum_name: string; enum_label: string }>(`
        select
          t.typname as enum_name,
          e.enumlabel as enum_label
        from pg_type t
        join pg_enum e on e.enumtypid = t.oid
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public'
        order by t.typname, e.enumsortorder;
      `),
      dbClient.queryObject<FunctionMeta>(`
        select p.proname, pg_get_functiondef(p.oid) as definition
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname not like 'pg_%'
        order by p.proname;
      `),
      dbClient.queryObject<PolicyMeta>(`
        select
          tablename,
          policyname,
          permissive,
          array_to_string(roles, ', ') as roles_sql,
          cmd,
          qual,
          with_check
        from pg_policies
        where schemaname = 'public'
        order by tablename, policyname;
      `),
      dbClient.queryObject<RlsMeta>(`
        select c.relname as table_name, c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
        order by c.relname;
      `),
    ]);

    const tableNames = tableRows.map((row) => row.table_name);
    const columnsByTable = new Map<string, ColumnMeta[]>();
    const constraintsByTable = new Map<string, ConstraintMeta[]>();
    const policiesByTable = new Map<string, PolicyMeta[]>();
    const rlsByTable = new Map<string, boolean>();
    const enumMap = new Map<string, string[]>();

    for (const row of columnRows) {
      const existing = columnsByTable.get(row.table_name) ?? [];
      existing.push(row);
      columnsByTable.set(row.table_name, existing);
    }

    for (const row of constraintRows) {
      const existing = constraintsByTable.get(row.table_name) ?? [];
      existing.push(row);
      constraintsByTable.set(row.table_name, existing);
    }

    for (const row of policyRows) {
      const existing = policiesByTable.get(row.tablename) ?? [];
      existing.push(row);
      policiesByTable.set(row.tablename, existing);
    }

    for (const row of rlsRows) {
      rlsByTable.set(row.table_name, row.relrowsecurity);
    }

    for (const row of enumRows) {
      const existing = enumMap.get(row.enum_name) ?? [];
      existing.push(row.enum_label);
      enumMap.set(row.enum_name, existing);
    }

    const sqlParts: string[] = [];
    sqlParts.push("-- FibraMap database logical backup");
    sqlParts.push(`-- Generated at ${new Date().toISOString()}`);
    sqlParts.push("begin;");
    sqlParts.push("set check_function_bodies = off;");
    sqlParts.push("");

    if (enumMap.size > 0) {
      sqlParts.push("-- Enums");
      for (const [enumName, enumValues] of enumMap.entries()) {
        const enumSql = enumValues.map(qliteral).join(", ");
        sqlParts.push(`drop type if exists public.${qident(enumName)} cascade;`);
        sqlParts.push(`create type public.${qident(enumName)} as enum (${enumSql});`);
      }
      sqlParts.push("");
    }

    if (functionRows.length > 0) {
      sqlParts.push("-- Functions");
      for (const fn of functionRows) {
        sqlParts.push(fn.definition.trim());
      }
      sqlParts.push("");
    }

    sqlParts.push("-- Tables");
    for (const tableName of tableNames) {
      const columns = columnsByTable.get(tableName) ?? [];
      sqlParts.push(`drop table if exists public.${qident(tableName)} cascade;`);
      sqlParts.push(`create table public.${qident(tableName)} (`);
      sqlParts.push(columns.map((column) => `  ${formatColumn(column)}`).join(",\n"));
      sqlParts.push(");");
      sqlParts.push("");
    }

    const nonForeignConstraints = constraintRows.filter((constraint) => constraint.contype !== "f");
    if (nonForeignConstraints.length > 0) {
      sqlParts.push("-- Non-foreign-key constraints");
      for (const constraint of nonForeignConstraints) {
        sqlParts.push(
          `alter table public.${qident(constraint.table_name)} add constraint ${qident(constraint.conname)} ${constraint.definition};`,
        );
      }
      sqlParts.push("");
    }

    if (!schemaOnly) {
      sqlParts.push("-- Data");
      for (const tableName of tableNames) {
        const pkColumns = (constraintsByTable.get(tableName) ?? [])
          .filter((constraint) => constraint.contype === "p")
          .flatMap((constraint) => {
            const match = constraint.definition.match(/\((.*)\)/);
            return match ? match[1].split(",").map((value) => value.trim().replace(/^"|"$/g, "")) : [];
          });

        const orderColumns = pkColumns.length > 0
          ? pkColumns.map((column) => qident(column)).join(", ")
          : qident((columnsByTable.get(tableName) ?? [])[0]?.column_name ?? "id");

        const countResult = await dbClient.queryObject<{ total: number }>(
          `select count(*)::int as total from public.${qident(tableName)};`,
        );
        const total = countResult.rows[0]?.total ?? 0;

        if (total === 0) {
          continue;
        }

        sqlParts.push(`-- ${tableName}: ${total} row(s)`);

        for (let offset = 0; offset < total; offset += BATCH_SIZE) {
          const rowsResult = await dbClient.queryObject<{ row: Record<string, unknown> }>(`
            select to_jsonb(t) as row
            from (
              select *
              from public.${qident(tableName)}
              order by ${orderColumns}
              limit ${BATCH_SIZE}
              offset ${offset}
            ) t;
          `);

          const payload = JSON.stringify(rowsResult.rows.map((entry) => entry.row)).replace(/'/g, "''");

          sqlParts.push(
            `insert into public.${qident(tableName)} select * from json_populate_recordset(null::public.${qident(tableName)}, '${payload}'::json);`,
          );
        }

        sqlParts.push("");
      }
    }

    const foreignConstraints = constraintRows.filter((constraint) => constraint.contype === "f");
    if (foreignConstraints.length > 0) {
      sqlParts.push("-- Foreign keys");
      for (const constraint of foreignConstraints) {
        sqlParts.push(
          `alter table public.${qident(constraint.table_name)} add constraint ${qident(constraint.conname)} ${constraint.definition};`,
        );
      }
      sqlParts.push("");
    }

    const rlsEnabledTables = tableNames.filter((tableName) => rlsByTable.get(tableName));
    if (rlsEnabledTables.length > 0) {
      sqlParts.push("-- Row level security");
      for (const tableName of rlsEnabledTables) {
        sqlParts.push(`alter table public.${qident(tableName)} enable row level security;`);
      }
      sqlParts.push("");
    }

    if (policyRows.length > 0) {
      sqlParts.push("-- Policies");
      for (const tableName of tableNames) {
        const tablePolicies = policiesByTable.get(tableName) ?? [];
        if (tablePolicies.length === 0) continue;

        for (const policy of tablePolicies) {
          sqlParts.push(buildCreatePolicySql(policy));
        }
      }
      sqlParts.push("");
    }

    sqlParts.push("commit;");
    sqlParts.push("");

    const sql = sqlParts.join("\n");
    const timestamp = toTimestampSlug();

    if (shouldGzip) {
      const gzipped = await gzipText(sql);
      return new Response(gzipped, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="fibramap-backup-${timestamp}.sql.gz"`,
        },
      });
    }

    return new Response(sql, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="fibramap-backup-${timestamp}.sql"`,
      },
    });
  } catch (err) {
    console.error("[database-backup] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Falha ao gerar backup do banco." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (dbClient) {
      await dbClient.end().catch(() => undefined);
    }
  }
});
