-- Enable guest email notifications by default (SMTP/Resend delivery).
-- WhatsApp/SMS stay opt-in until providers are configured.
ALTER TABLE public.restaurant_settings
  ALTER COLUMN notifications_email_enabled SET DEFAULT true;

UPDATE public.restaurant_settings
SET notifications_email_enabled = true
WHERE notifications_email_enabled = false;
