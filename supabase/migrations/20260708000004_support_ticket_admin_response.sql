-- Migration: support ticket admin response + user notification
-- Run date: 2026-07-08

-- 1. Admin response fields on support tickets
ALTER TABLE public.support_tickets
ADD COLUMN IF NOT EXISTS admin_response text,
ADD COLUMN IF NOT EXISTS responded_at timestamp with time zone;

-- 2. Trigger function: notify the user when an admin responds to their ticket
CREATE OR REPLACE FUNCTION public.notify_support_ticket_response()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.admin_response IS NOT NULL AND (OLD.admin_response IS NULL OR NEW.admin_response <> OLD.admin_response) THEN
    NEW.responded_at = COALESCE(NEW.responded_at, NOW());
    INSERT INTO public.notifications (user_id, title, message, type, source, meta)
    VALUES (
      NEW.user_id,
      'Support ticket response',
      NEW.admin_response,
      'info',
      'support_ticket',
      jsonb_build_object('ticket_id', NEW.id, 'ticket_ref', NEW.ticket_ref)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger on support_tickets updates
DROP TRIGGER IF EXISTS support_ticket_response_notifier ON public.support_tickets;
CREATE TRIGGER support_ticket_response_notifier
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_support_ticket_response();
