-- Add WhatsApp Business API fields to properties table
ALTER TABLE properties 
ADD COLUMN whatsapp_phone_number_id TEXT,
ADD COLUMN whatsapp_access_token TEXT;
