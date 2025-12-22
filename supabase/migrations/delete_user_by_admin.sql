-- Create a function to allow admins to delete users
-- This function runs with SECURITY DEFINER privileges to bypass RLS for the auth.users table

create or replace function public.delete_user_by_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requesting_user_id uuid;
  requesting_user_role text;
  requesting_org_id uuid;
  target_org_id uuid;
begin
  -- Get the ID of the user executing the function
  requesting_user_id := auth.uid();
  
  -- Check if the requesting user is authenticated
  if requesting_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get the role and organization of the requesting user
  select role, organization_id into requesting_user_role, requesting_org_id
  from public.users
  where id = requesting_user_id;

  -- Check if requester is an admin
  if requesting_user_role != 'admin' then
    raise exception 'Unauthorized: Only admins can delete users';
  end if;

  -- Get the organization of the target user
  select organization_id into target_org_id
  from public.users
  where id = target_user_id;

  -- Ensure target user exists
  if target_org_id is null then
    raise exception 'User not found';
  end if;

  -- Ensure admin can only delete users in their own organization
  -- (Optional: remove this check if you want super-admins)
  if requesting_org_id != target_org_id then
    raise exception 'Unauthorized: You can only delete users in your organization';
  end if;

  -- Prevent self-deletion
  if requesting_user_id = target_user_id then
    raise exception 'Cannot delete your own account';
  end if;

  -- Delete from auth.users
  -- This will cascade to public.users if you have ON DELETE CASCADE setup on your FK
  -- Ideally, your public.users table should be defined like:
  -- id uuid references auth.users(id) on delete cascade
  delete from auth.users where id = target_user_id;

end;
$$;
