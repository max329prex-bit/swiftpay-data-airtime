-- Migration: Free Transfer Deposit System
-- Run date: 2026-07-07
-- See: supabase/functions/verify-free-transfer/index.ts

-- Tables: free_transfer_deposits, opay_used_emails
-- Profile columns: ft_bank_name, ft_account_name, ft_account_number
-- RPC: credit_wallet_from_free_transfer(_user_id, _amount, _deposit_id)
-- (This migration was already applied directly via Supabase Management API)
