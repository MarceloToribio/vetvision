-- =====================================================================
-- VetVision — Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- USUARIOS (perfil del veterinario; la autenticación la gestiona auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.usuarios (
  id           uuid primary key references auth.users(id) on delete cascade,
  nombre       text,
  clinica      text,
  colegiatura  text,
  creado_en    timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse
create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, nombre, clinica)
  values (new.id, new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'clinica');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- La función solo debe ejecutarla el trigger, no la API pública
revoke execute on function public.crear_perfil_usuario() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- PACIENTES
-- ---------------------------------------------------------------------
create table if not exists public.pacientes (
  id              uuid primary key default gen_random_uuid(),
  veterinario_id  uuid not null references auth.users(id) on delete cascade,
  nombre          text,
  especie         text not null check (especie in ('perro', 'gato')),
  raza            text,
  edad_anios      numeric(5,2),
  peso_kg         numeric(6,2),
  sexo            text check (sexo in ('macho', 'hembra')),
  creado_en       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CASOS
-- ---------------------------------------------------------------------
create table if not exists public.casos (
  id                  uuid primary key default gen_random_uuid(),
  veterinario_id      uuid not null references auth.users(id) on delete cascade,
  paciente_id         uuid not null references public.pacientes(id) on delete cascade,
  zona_afectada       text not null,
  sintomas            text,
  tiempo_evolucion    text,
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente', 'analizado', 'revisado', 'error')),
  analisis            jsonb,          -- respuesta estructurada de la IA
  diagnostico_ia      text,           -- copia del diagnóstico principal (para buscar/filtrar)
  urgencia            text check (urgencia in ('rutina', 'pronto', 'urgente')),
  diagnostico_final   text,           -- confirmado/corregido por el veterinario
  tratamiento_final   text,
  notas_veterinario   text,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);

create index if not exists casos_vet_fecha_idx on public.casos (veterinario_id, creado_en desc);

-- ---------------------------------------------------------------------
-- IMÁGENES
-- ---------------------------------------------------------------------
create table if not exists public.imagenes (
  id              uuid primary key default gen_random_uuid(),
  caso_id         uuid not null references public.casos(id) on delete cascade,
  veterinario_id  uuid not null references auth.users(id) on delete cascade,
  ruta            text not null,                 -- ruta dentro del bucket
  tipo            text not null default 'inicial' check (tipo in ('inicial', 'seguimiento')),
  creado_en       timestamptz not null default now()
);

create index if not exists imagenes_caso_idx on public.imagenes (caso_id);

-- ---------------------------------------------------------------------
-- CONVERSACIONES (una por caso) y MENSAJES
-- ---------------------------------------------------------------------
create table if not exists public.conversaciones (
  id                   uuid primary key default gen_random_uuid(),
  caso_id              uuid not null unique references public.casos(id) on delete cascade,
  veterinario_id       uuid not null references auth.users(id) on delete cascade,
  resumen              text,                    -- resumen de mensajes antiguos
  mensajes_resumidos   int  not null default 0, -- cuántos mensajes cubre el resumen
  creado_en            timestamptz not null default now()
);

create table if not exists public.mensajes (
  id                uuid primary key default gen_random_uuid(),
  conversacion_id   uuid not null references public.conversaciones(id) on delete cascade,
  veterinario_id    uuid not null references auth.users(id) on delete cascade,
  rol               text not null check (rol in ('user', 'assistant')),
  contenido         text not null,
  imagenes          text[] not null default '{}',  -- rutas en el bucket
  creado_en         timestamptz not null default now()
);

create index if not exists mensajes_conv_idx on public.mensajes (conversacion_id, creado_en);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY: cada veterinario solo accede a sus propios datos
-- ---------------------------------------------------------------------
alter table public.usuarios       enable row level security;
alter table public.pacientes      enable row level security;
alter table public.casos          enable row level security;
alter table public.imagenes       enable row level security;
alter table public.conversaciones enable row level security;
alter table public.mensajes       enable row level security;

drop policy if exists "perfil propio" on public.usuarios;
create policy "perfil propio" on public.usuarios
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "pacientes propios" on public.pacientes;
create policy "pacientes propios" on public.pacientes
  for all using (veterinario_id = auth.uid()) with check (veterinario_id = auth.uid());

drop policy if exists "casos propios" on public.casos;
create policy "casos propios" on public.casos
  for all using (veterinario_id = auth.uid()) with check (veterinario_id = auth.uid());

drop policy if exists "imagenes propias" on public.imagenes;
create policy "imagenes propias" on public.imagenes
  for all using (veterinario_id = auth.uid()) with check (veterinario_id = auth.uid());

drop policy if exists "conversaciones propias" on public.conversaciones;
create policy "conversaciones propias" on public.conversaciones
  for all using (veterinario_id = auth.uid()) with check (veterinario_id = auth.uid());

drop policy if exists "mensajes propios" on public.mensajes;
create policy "mensajes propios" on public.mensajes
  for all using (veterinario_id = auth.uid()) with check (veterinario_id = auth.uid());

-- ---------------------------------------------------------------------
-- STORAGE: bucket privado. Ruta de cada archivo: {veterinario_id}/{caso_id}/{archivo}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes-casos', 'imagenes-casos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "vet lee sus imagenes" on storage.objects;
create policy "vet lee sus imagenes" on storage.objects
  for select using (
    bucket_id = 'imagenes-casos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "vet sube sus imagenes" on storage.objects;
create policy "vet sube sus imagenes" on storage.objects
  for insert with check (
    bucket_id = 'imagenes-casos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "vet borra sus imagenes" on storage.objects;
create policy "vet borra sus imagenes" on storage.objects
  for delete using (
    bucket_id = 'imagenes-casos' and (storage.foldername(name))[1] = auth.uid()::text
  );
