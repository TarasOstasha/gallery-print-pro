create or replace function public.next_order_number()
returns text language sql volatile security definer set search_path = public as $$
  select nextval('public.order_number_seq')::text
$$;
revoke all on function public.next_order_number() from public, anon, authenticated;
grant execute on function public.next_order_number() to service_role;

-- Storage: admins manage photo assets; previews are served through signed URLs only.
create policy "Admins read photo buckets" on storage.objects for select to authenticated
using (bucket_id in ('photo-previews','photo-originals') and public.has_role(auth.uid(),'admin'));

create policy "Admins upload photo buckets" on storage.objects for insert to authenticated
with check (bucket_id in ('photo-previews','photo-originals') and public.has_role(auth.uid(),'admin'));

create policy "Admins update photo buckets" on storage.objects for update to authenticated
using (bucket_id in ('photo-previews','photo-originals') and public.has_role(auth.uid(),'admin'));

create policy "Admins delete photo buckets" on storage.objects for delete to authenticated
using (bucket_id in ('photo-previews','photo-originals') and public.has_role(auth.uid(),'admin'));
