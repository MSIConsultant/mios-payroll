-- Migration: admin SECURITY DEFINER functions
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run)
--
-- Fixes: approve/reject/suspend in /dev/admin were silently no-ops because
-- profiles_own_update RLS policy (auth.uid() = id) blocked cross-row updates.
-- These functions bypass RLS while verifying the caller is the dev account.

CREATE OR REPLACE FUNCTION admin_approve_user(target_id uuid, new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email  text;
  target_email  text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'msiconsultant.international@gmail.com' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT email INTO target_email FROM public.user_profiles WHERE id = target_id;

  UPDATE public.user_profiles
  SET status      = 'approved',
      role        = new_role,
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = target_id;

  -- workspace_id is null at approval time; assigned during onboarding
  INSERT INTO public.notifications (workspace_id, recipient_id, type, title, message, data)
  VALUES (
    NULL,
    target_id,
    'ACCOUNT_APPROVED',
    'Akun Anda Disetujui',
    'Selamat! Akun Anda telah disetujui sebagai ' ||
      CASE WHEN new_role = 'accountant' THEN 'Akuntan' ELSE 'Staff' END || '.',
    jsonb_build_object('role', new_role)
  );

  RETURN jsonb_build_object('success', true, 'email', target_email);
END;
$$;

CREATE OR REPLACE FUNCTION admin_reject_user(target_id uuid, reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email  text;
  target_email  text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'msiconsultant.international@gmail.com' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT email INTO target_email FROM public.user_profiles WHERE id = target_id;

  UPDATE public.user_profiles
  SET status          = 'rejected',
      rejected_reason = reason
  WHERE id = target_id;

  RETURN jsonb_build_object('success', true, 'email', target_email);
END;
$$;

CREATE OR REPLACE FUNCTION admin_suspend_user(target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'msiconsultant.international@gmail.com' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.user_profiles
  SET status = 'suspended'
  WHERE id = target_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
