#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@seudominio.com';
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME || 'Administrador Avalia Saúde';

if (!supabaseUrl) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL nÃ£o foi encontrada. Configure o arquivo .env.local.');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('Erro: SUPABASE_SERVICE_ROLE_KEY nÃ£o foi encontrada. Ela Ã© necessÃ¡ria apenas para criar o usuÃ¡rio admin via script local.');
  process.exit(1);
}

if (!adminPassword) {
  console.error('Erro: ADMIN_PASSWORD nÃ£o foi encontrada. Defina no .env.local ou rode o comando informando essa variÃ¡vel.');
  process.exit(1);
}

if (adminPassword.length < 8) {
  console.error('Erro: ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;

    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const existingUser = await findUserByEmail(adminEmail);
  let userId;

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        ...existingUser.user_metadata,
        full_name: adminName,
      },
    });

    if (error) throw error;
    userId = data.user.id;
    console.log(`UsuÃ¡rio atualizado: ${adminEmail}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminName,
      },
    });

    if (error) throw error;
    userId = data.user.id;
    console.log(`UsuÃ¡rio criado: ${adminEmail}`);
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: adminName,
      email: adminEmail,
      role: 'admin',
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (profileError) throw profileError;

  console.log('Perfil configurado como admin e active.');
  console.log('Pronto. VocÃª jÃ¡ pode acessar o sistema com o e-mail administrativo configurado.');
}

main().catch((error) => {
  console.error('Falha ao configurar usuÃ¡rio administrador:');
  console.error(error.message || error);
  process.exit(1);
});
