-- Photo retention / deletion audit fields for customer uploads.
-- Keeps order + line-item business data; tracks when Storage binaries were removed.

alter table public.photos
  add column if not exists original_file_name text;

alter table public.photos
  add column if not exists deleted_at timestamptz;

comment on column public.photos.original_file_name is
  'Original customer upload filename; retained after Storage deletion.';

comment on column public.photos.deleted_at is
  'When original/preview Storage objects (and print_file_blobs) were removed. NULL = still available or never stored.';

comment on column public.photos.original_path is
  'Historical Storage path in photo-originals (or null). Kept after deletion for audit.';
