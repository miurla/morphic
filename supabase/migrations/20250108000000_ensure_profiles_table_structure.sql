-- Migration: Ensure profiles table structure for Bulldozer Search
-- Description: Updates the existing profiles table to support Local 825's authentication system
-- Date: 2025-01-08

-- Add missing columns to profiles table if they don't exist
do $$
begin
  -- Add email column if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'profiles' and column_name = 'email') then
    alter table public.profiles add column email text;
  end if;
  
  -- Add full_name column if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'profiles' and column_name = 'full_name') then
    alter table public.profiles add column full_name text;
  end if;
end $$;

-- Update table comment
comment on table public.profiles is 'Local 825 user profiles for Bulldozer Search application';

-- Enable Row Level Security if not already enabled
alter table public.profiles enable row level security;

-- Drop existing policies if they exist (to recreate them)
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Allow user insertion" on public.profiles;

-- Create RLS policies for profiles table
-- Users can view their own profile
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Allow insertion of new profiles (for OAuth and sign-up)
create policy "Allow profile insertion"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

-- Create function to handle profile creation on auth.users insert
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, 
    username,
    email, 
    full_name, 
    avatar_url,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Create trigger to automatically create profile record
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- Create function to update updated_at timestamp
create or replace function public.handle_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Create trigger to automatically update updated_at
drop trigger if exists handle_profiles_updated_at on public.profiles;
create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_profile_updated_at(); 