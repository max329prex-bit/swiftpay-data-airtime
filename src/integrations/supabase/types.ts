export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          balance_after: number | null
          balance_before: number | null
          created_at: string
          id: string
          meta: Json | null
          reason: string
          target_transaction_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          id?: string
          meta?: Json | null
          reason: string
          target_transaction_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          id?: string
          meta?: Json | null
          reason?: string
          target_transaction_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_target_transaction_id_fkey"
            columns: ["target_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_otp: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      admin_otps: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          revoked: boolean
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          revoked?: boolean
          token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          revoked?: boolean
          token?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string | null
          permissions: Json | null
          rate_limit_per_minute: number | null
          user_id: string
          wallet_discount_percent: number | null
        }
        Insert: {
          api_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          permissions?: Json | null
          rate_limit_per_minute?: number | null
          user_id: string
          wallet_discount_percent?: number | null
        }
        Update: {
          api_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          permissions?: Json | null
          rate_limit_per_minute?: number | null
          user_id?: string
          wallet_discount_percent?: number | null
        }
        Relationships: []
      }
      api_purchases: {
        Row: {
          amount: number
          api_key_id: string
          charge_amount: number
          completed_at: string | null
          created_at: string | null
          discount_amount: number
          final_amount: number
          id: string
          meta: Json | null
          network: string
          phone: string
          provider_reference: string | null
          reference: string
          status: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          api_key_id: string
          charge_amount?: number
          completed_at?: string | null
          created_at?: string | null
          discount_amount?: number
          final_amount: number
          id?: string
          meta?: Json | null
          network: string
          phone: string
          provider_reference?: string | null
          reference: string
          status?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          api_key_id?: string
          charge_amount?: number
          completed_at?: string | null
          created_at?: string | null
          discount_amount?: number
          final_amount?: number
          id?: string
          meta?: Json | null
          network?: string
          phone?: string
          provider_reference?: string | null
          reference?: string
          status?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_purchases_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_purchases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      beneficiaries: {
        Row: {
          created_at: string
          id: string
          network: string
          nickname: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          network: string
          nickname: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          network?: string
          nickname?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      bundle_status: {
        Row: {
          auto_paused_at: string | null
          auto_paused_reason: string | null
          avg_response_ms: number | null
          created_at: string
          fail_count: number
          health_score: number
          id: string
          is_available: boolean
          last_checked_at: string
          last_error: string | null
          last_success_at: string | null
          network: string
          package_code: string
          provider_code: string
          success_count: number
          total_attempts: number
        }
        Insert: {
          auto_paused_at?: string | null
          auto_paused_reason?: string | null
          avg_response_ms?: number | null
          created_at?: string
          fail_count?: number
          health_score?: number
          id?: string
          is_available?: boolean
          last_checked_at?: string
          last_error?: string | null
          last_success_at?: string | null
          network: string
          package_code: string
          provider_code: string
          success_count?: number
          total_attempts?: number
        }
        Update: {
          auto_paused_at?: string | null
          auto_paused_reason?: string | null
          avg_response_ms?: number | null
          created_at?: string
          fail_count?: number
          health_score?: number
          id?: string
          is_available?: boolean
          last_checked_at?: string
          last_error?: string | null
          last_success_at?: string | null
          network?: string
          package_code?: string
          provider_code?: string
          success_count?: number
          total_attempts?: number
        }
        Relationships: []
      }
      fraud_velocity: {
        Row: {
          count: number
          created_at: string
          event_type: string
          flagged_at: string | null
          id: string
          is_flagged: boolean
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          event_type: string
          flagged_at?: string | null
          id?: string
          is_flagged?: boolean
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id: string
          window_start?: string
        }
        Update: {
          count?: number
          created_at?: string
          event_type?: string
          flagged_at?: string | null
          id?: string
          is_flagged?: boolean
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      free_transfer_deposits: {
        Row: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          created_at: string | null
          credited_amount: number | null
          expires_at: string | null
          id: string
          matched_amount: number | null
          matched_at: string | null
          matched_email_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          amount: number
          bank_name: string
          created_at?: string | null
          credited_amount?: number | null
          expires_at?: string | null
          id?: string
          matched_amount?: number | null
          matched_at?: string | null
          matched_email_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          amount?: number
          bank_name?: string
          created_at?: string | null
          credited_amount?: number | null
          expires_at?: string | null
          id?: string
          matched_amount?: number | null
          matched_at?: string | null
          matched_email_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      liquidity_reservations: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          provider_code: string
          status: string
          tx_reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string
          id?: string
          provider_code: string
          status?: string
          tx_reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          provider_code?: string
          status?: string
          tx_reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          meta: Json | null
          source: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          meta?: Json | null
          source?: string | null
          title?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          meta?: Json | null
          source?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      opay_used_emails: {
        Row: {
          amount: number | null
          deposit_id: string | null
          message_uid: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          deposit_id?: string | null
          message_uid: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          deposit_id?: string | null
          message_uid?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opay_used_emails_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "free_transfer_deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          bp_value: number
          coming_soon: boolean
          cost_price: number
          created_at: string
          fallback_package_code: string | null
          fallback_provider_code: string | null
          health_score: number
          id: string
          is_active: boolean
          is_blitz_prime: boolean
          name: string
          network: string
          package_code: string
          price: number
          provider_code: string
          requires_non_owing_line: boolean
          size: string
          sort_order: number
          tier: string
          validity: string
        }
        Insert: {
          bp_value?: number
          coming_soon?: boolean
          cost_price?: number
          created_at?: string
          fallback_package_code?: string | null
          fallback_provider_code?: string | null
          health_score?: number
          id?: string
          is_active?: boolean
          is_blitz_prime?: boolean
          name: string
          network: string
          package_code: string
          price: number
          provider_code: string
          requires_non_owing_line?: boolean
          size: string
          sort_order?: number
          tier?: string
          validity: string
        }
        Update: {
          bp_value?: number
          coming_soon?: boolean
          cost_price?: number
          created_at?: string
          fallback_package_code?: string | null
          fallback_provider_code?: string | null
          health_score?: number
          id?: string
          is_active?: boolean
          is_blitz_prime?: boolean
          name?: string
          network?: string
          package_code?: string
          price?: number
          provider_code?: string
          requires_non_owing_line?: boolean
          size?: string
          sort_order?: number
          tier?: string
          validity?: string
        }
        Relationships: []
      }
      payvessel_dynamic_requests: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_used: boolean
          tracking_reference: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          tracking_reference: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          tracking_reference?: string
          user_id?: string
        }
        Relationships: []
      }
      payvessel_virtual_accounts: {
        Row: {
          account_name: string | null
          account_number: string
          bank_code: string | null
          bank_name: string | null
          created_at: string
          id: string
          pv_reference: string | null
          tracking_reference: string | null
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          pv_reference?: string | null
          tracking_reference?: string | null
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          pv_reference?: string | null
          tracking_reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payvessel_webhook_raw_logs: {
        Row: {
          account_num: string | null
          amount_raw: string | null
          client_ip: string | null
          credit_result: string | null
          event_field: string | null
          id: string
          pv_ref: string | null
          raw_body: string | null
          received_at: string
          tracking_ref: string | null
          user_found: boolean | null
          user_id: string | null
        }
        Insert: {
          account_num?: string | null
          amount_raw?: string | null
          client_ip?: string | null
          credit_result?: string | null
          event_field?: string | null
          id?: string
          pv_ref?: string | null
          raw_body?: string | null
          received_at?: string
          tracking_ref?: string | null
          user_found?: boolean | null
          user_id?: string | null
        }
        Update: {
          account_num?: string | null
          amount_raw?: string | null
          client_ip?: string | null
          credit_result?: string | null
          event_field?: string | null
          id?: string
          pv_ref?: string | null
          raw_body?: string | null
          received_at?: string
          tracking_ref?: string | null
          user_found?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bvn: string | null
          created_at: string
          email: string | null
          ft_account_name: string | null
          ft_account_number: string | null
          ft_bank_name: string | null
          full_name: string | null
          id: string
          nin: string | null
          phone: string | null
          swift_points: number
          transaction_pin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bvn?: string | null
          created_at?: string
          email?: string | null
          ft_account_name?: string | null
          ft_account_number?: string | null
          ft_bank_name?: string | null
          full_name?: string | null
          id?: string
          nin?: string | null
          phone?: string | null
          swift_points?: number
          transaction_pin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bvn?: string | null
          created_at?: string
          email?: string | null
          ft_account_name?: string | null
          ft_account_number?: string | null
          ft_bank_name?: string | null
          full_name?: string | null
          id?: string
          nin?: string | null
          phone?: string | null
          swift_points?: number
          transaction_pin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_treasury: {
        Row: {
          actual_balance: number
          avg_spend_10min: number
          avg_spend_1hr: number
          bank_account_number: string | null
          bank_code: string | null
          bank_name: string | null
          cb_failures: number
          cb_paused_until: string | null
          critical_stop_threshold: number
          daily_cap_reset_at: string
          daily_refill_cap: number
          daily_refilled_today: number
          id: string
          last_refill_at: string | null
          last_synced_at: string | null
          provider_code: string
          refill_cooldown_minutes: number
          refill_target: number
          refill_threshold: number
          reserved_balance: number
          transfer_health: string
          updated_at: string
        }
        Insert: {
          actual_balance?: number
          avg_spend_10min?: number
          avg_spend_1hr?: number
          bank_account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          cb_failures?: number
          cb_paused_until?: string | null
          critical_stop_threshold?: number
          daily_cap_reset_at?: string
          daily_refill_cap?: number
          daily_refilled_today?: number
          id?: string
          last_refill_at?: string | null
          last_synced_at?: string | null
          provider_code: string
          refill_cooldown_minutes?: number
          refill_target?: number
          refill_threshold?: number
          reserved_balance?: number
          transfer_health?: string
          updated_at?: string
        }
        Update: {
          actual_balance?: number
          avg_spend_10min?: number
          avg_spend_1hr?: number
          bank_account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          cb_failures?: number
          cb_paused_until?: string | null
          critical_stop_threshold?: number
          daily_cap_reset_at?: string
          daily_refill_cap?: number
          daily_refilled_today?: number
          id?: string
          last_refill_at?: string | null
          last_synced_at?: string | null
          provider_code?: string
          refill_cooldown_minutes?: number
          refill_target?: number
          refill_threshold?: number
          reserved_balance?: number
          transfer_health?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_purchases: {
        Row: {
          amount: number
          bp_value: number | null
          bundle_size: string | null
          created_at: string
          end_at: string | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          interval_days: number | null
          last_error: string | null
          last_run_at: string | null
          meta: Json
          network: string
          next_run_at: string
          package_code: string | null
          phone: string
          provider_code: string | null
          recipient_label: string | null
          reserved_amount: number
          retry_count: number
          status: Database["public"]["Enums"]["schedule_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bp_value?: number | null
          bundle_size?: string | null
          created_at?: string
          end_at?: string | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          interval_days?: number | null
          last_error?: string | null
          last_run_at?: string | null
          meta?: Json
          network: string
          next_run_at: string
          package_code?: string | null
          phone: string
          provider_code?: string | null
          recipient_label?: string | null
          reserved_amount?: number
          retry_count?: number
          status?: Database["public"]["Enums"]["schedule_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bp_value?: number | null
          bundle_size?: string | null
          created_at?: string
          end_at?: string | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          interval_days?: number | null
          last_error?: string | null
          last_run_at?: string | null
          meta?: Json
          network?: string
          next_run_at?: string
          package_code?: string | null
          phone?: string
          provider_code?: string | null
          recipient_label?: string | null
          reserved_amount?: number
          retry_count?: number
          status?: Database["public"]["Enums"]["schedule_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_runs: {
        Row: {
          attempt_no: number
          error: string | null
          id: string
          meta: Json
          ran_at: string
          schedule_id: string
          status: string
          tx_id: string | null
          user_id: string
        }
        Insert: {
          attempt_no?: number
          error?: string | null
          id?: string
          meta?: Json
          ran_at?: string
          schedule_id: string
          status: string
          tx_id?: string | null
          user_id: string
        }
        Update: {
          attempt_no?: number
          error?: string | null
          id?: string
          meta?: Json
          ran_at?: string
          schedule_id?: string
          status?: string
          tx_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "scheduled_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_notified: {
        Row: {
          emailed_at: string
          ticket_id: string
        }
        Insert: {
          emailed_at?: string
          ticket_id: string
        }
        Update: {
          emailed_at?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_notified_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          created_at: string
          id: string
          intent: string
          message: string | null
          related_transaction_id: string | null
          resolved_at: string | null
          status: string
          ticket_ref: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          intent: string
          message?: string | null
          related_transaction_id?: string | null
          resolved_at?: string | null
          status?: string
          ticket_ref?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          intent?: string
          message?: string | null
          related_transaction_id?: string | null
          resolved_at?: string | null
          status?: string
          ticket_ref?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          aidapay_hash?: string | null
          aidapay_status?: string | null
          amount: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          last_recovery_at?: string | null
          last_verification_at?: string | null
          meta?: Json | null
          network?: string | null
          phone?: string | null
          provider_reference?: string | null
          recovery_attempts?: number | null
          reference: string
          retry_count?: number
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          aidapay_hash?: string | null
          aidapay_status?: string | null
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          last_recovery_at?: string | null
          last_verification_at?: string | null
          meta?: Json | null
          network?: string | null
          phone?: string | null
          provider_reference?: string | null
          recovery_attempts?: number | null
          reference?: string
          retry_count?: number
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      treasury_ledger: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          direction: string
          id: string
          notes: string | null
          provider_code: string
          reference: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          direction: string
          id?: string
          notes?: string | null
          provider_code: string
          reference?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          direction?: string
          id?: string
          notes?: string | null
          provider_code?: string
          reference?: string | null
        }
        Relationships: []
      }
      treasury_transfers: {
        Row: {
          account_number: string | null
          amount: number
          balance_after: number | null
          balance_before: number | null
          bank_code: string | null
          confirmed_at: string | null
          failure_reason: string | null
          id: string
          initiated_at: string
          korapay_reference: string | null
          last_checked_at: string | null
          provider_code: string
          retries: number
          status: string
        }
        Insert: {
          account_number?: string | null
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          bank_code?: string | null
          confirmed_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string
          korapay_reference?: string | null
          last_checked_at?: string | null
          provider_code: string
          retries?: number
          status?: string
        }
        Update: {
          account_number?: string | null
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          bank_code?: string | null
          confirmed_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string
          korapay_reference?: string | null
          last_checked_at?: string | null
          provider_code?: string
          retries?: number
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_accounts: {
        Row: {
          account_name: string | null
          account_number: string | null
          account_reference: string
          bank_code: string | null
          bank_name: string | null
          created_at: string
          id: string
          korapay_account_reference: string | null
          payment_provider: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          account_reference: string
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          korapay_account_reference?: string | null
          payment_provider?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          account_reference?: string
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          korapay_account_reference?: string | null
          payment_provider?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          direction: string
          id: string
          meta: Json | null
          reason: string
          reference: string | null
          related_transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          direction: string
          id?: string
          meta?: Json | null
          reason: string
          reference?: string | null
          related_transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          direction?: string
          id?: string
          meta?: Json | null
          reason?: string
          reference?: string | null
          related_transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          profit_balance: number
          refund_balance: number
          reserved_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          profit_balance?: number
          refund_balance?: number
          reserved_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          profit_balance?: number
          refund_balance?: number
          reserved_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          event_type: string | null
          id: string
          payload: Json | null
          processed_at: string
          provider: string
        }
        Insert: {
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string
          provider: string
        }
        Update: {
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string
          provider?: string
        }
        Relationships: []
      }
      webhook_log: {
        Row: {
          client_ip: string | null
          created_at: string | null
          headers: Json | null
          id: string
          raw_body: string | null
          source: string | null
        }
        Insert: {
          client_ip?: string | null
          created_at?: string | null
          headers?: Json | null
          id?: string
          raw_body?: string | null
          source?: string | null
        }
        Update: {
          client_ip?: string | null
          created_at?: string | null
          headers?: Json | null
          id?: string
          raw_body?: string | null
          source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_commit_transaction: {
        Args: {
          _admin_id: string
          _notes?: string
          _provider_reference?: string
          _tx_id: string
        }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_fail_and_refund_transaction: {
        Args: { _admin_id: string; _reason?: string; _tx_id: string }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_users: {
        Args: never
        Returns: {
          balance: number
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          role: string
          tx_count: number
          wallet_funded: boolean
        }[]
      }
      advance_schedule_after_success: {
        Args: { _schedule_id: string }
        Returns: undefined
      }
      api_purchase_data: {
        Args: {
          _api_key: string
          _network: string
          _package_code: string
          _phone: string
        }
        Returns: Json
      }
      cancel_schedule: { Args: { _id: string }; Returns: undefined }
      commit_transaction: {
        Args: { _meta?: Json; _provider_reference?: string; _tx_id: string }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_vtu_transaction: {
        Args: { _aidapay_hash: string; _meta?: Json; _status: string }
        Returns: undefined
      }
      compute_next_run: {
        Args: {
          _freq: Database["public"]["Enums"]["schedule_frequency"]
          _from: string
          _interval_days: number
        }
        Returns: string
      }
      confirm_treasury_transfer: {
        Args: { _new_balance: number; _transfer_id: string }
        Returns: undefined
      }
      consume_schedule_reservation: {
        Args: { _aidapay_hash: string; _schedule_id: string }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_schedule: {
        Args: {
          _amount: number
          _bp_value: number
          _bundle_size: string
          _first_run_at: string
          _frequency: Database["public"]["Enums"]["schedule_frequency"]
          _interval_days: number
          _meta?: Json
          _network: string
          _package_code: string
          _phone: string
          _pin: string
          _provider_code: string
          _recipient_label: string
          _type: Database["public"]["Enums"]["tx_type"]
        }
        Returns: {
          amount: number
          bp_value: number | null
          bundle_size: string | null
          created_at: string
          end_at: string | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          interval_days: number | null
          last_error: string | null
          last_run_at: string | null
          meta: Json
          network: string
          next_run_at: string
          package_code: string | null
          phone: string
          provider_code: string | null
          recipient_label: string | null
          reserved_amount: number
          retry_count: number
          status: Database["public"]["Enums"]["schedule_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "scheduled_purchases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vtu_transaction:
        | {
            Args: {
              _aidapay_hash: string
              _amount: number
              _meta?: Json
              _network: string
              _phone: string
              _type: Database["public"]["Enums"]["tx_type"]
              _user_id: string
            }
            Returns: {
              aidapay_hash: string | null
              aidapay_status: string | null
              amount: number
              created_at: string
              failure_reason: string | null
              id: string
              idempotency_key: string | null
              last_recovery_at: string | null
              last_verification_at: string | null
              meta: Json | null
              network: string | null
              phone: string | null
              provider_reference: string | null
              recovery_attempts: number | null
              reference: string
              retry_count: number
              status: Database["public"]["Enums"]["tx_status"]
              type: Database["public"]["Enums"]["tx_type"]
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "transactions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _aidapay_hash: string
              _amount: number
              _bp?: number
              _meta?: Json
              _network: string
              _phone: string
              _type: Database["public"]["Enums"]["tx_type"]
              _user_id: string
            }
            Returns: {
              aidapay_hash: string | null
              aidapay_status: string | null
              amount: number
              created_at: string
              failure_reason: string | null
              id: string
              idempotency_key: string | null
              last_recovery_at: string | null
              last_verification_at: string | null
              meta: Json | null
              network: string | null
              phone: string | null
              provider_reference: string | null
              recovery_attempts: number | null
              reference: string
              retry_count: number
              status: Database["public"]["Enums"]["tx_status"]
              type: Database["public"]["Enums"]["tx_type"]
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "transactions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      credit_wallet_from_free_transfer: {
        Args: { _amount: number; _deposit_id: string; _user_id: string }
        Returns: number
      }
      credit_wallet_from_korapay: {
        Args: { _amount: number; _korapay_ref: string; _user_id: string }
        Returns: undefined
      }
      credit_wallet_from_payvessel: {
        Args: { _amount: number; _pv_ref: string; _user_id: string }
        Returns: undefined
      }
      debit_and_create_transaction: {
        Args: {
          _amount: number
          _meta?: Json
          _network: string
          _phone: string
          _reference?: string
          _type: Database["public"]["Enums"]["tx_type"]
          _user_id: string
        }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_and_refund_transaction: {
        Args: { _reason?: string; _tx_id: string }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fetch_due_schedules: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          bp_value: number | null
          bundle_size: string | null
          created_at: string
          end_at: string | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          interval_days: number | null
          last_error: string | null
          last_run_at: string | null
          meta: Json
          network: string
          next_run_at: string
          package_code: string | null
          phone: string
          provider_code: string | null
          recipient_label: string | null
          reserved_amount: number
          retry_count: number
          status: Database["public"]["Enums"]["schedule_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduled_purchases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_api_key: {
        Args: { _key_name?: string; _user_id: string }
        Returns: Json
      }
      get_package_with_min_price: {
        Args: { _pkg_code: string }
        Returns: {
          bp_value: number
          coming_soon: boolean
          cost_price: number
          created_at: string
          fallback_package_code: string | null
          fallback_provider_code: string | null
          health_score: number
          id: string
          is_active: boolean
          is_blitz_prime: boolean
          name: string
          network: string
          package_code: string
          price: number
          provider_code: string
          requires_non_owing_line: boolean
          size: string
          sort_order: number
          tier: string
          validity: string
        }
        SetofOptions: {
          from: "*"
          to: "packages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_pending_transactions: {
        Args: { _hours_back?: number }
        Returns: {
          age_minutes: number
          amount: number
          created_at: string
          id: string
          meta: Json
          network: string
          phone: string
          reference: string
          status: string
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }[]
      }
      handle_schedule_failure: {
        Args: { _err: string; _schedule_id: string }
        Returns: undefined
      }
      has_role:
        | {
            Args: { _role: Database["public"]["Enums"]["app_role"] }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      has_transaction_pin: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_admin_session: { Args: { _token: string }; Returns: boolean }
      is_tx_pending: { Args: { _tx_id: string }; Returns: boolean }
      list_api_keys: { Args: { _user_id: string }; Returns: Json }
      mark_bundle_available: {
        Args: {
          _network: string
          _package_code: string
          _provider_code: string
        }
        Returns: undefined
      }
      mark_bundle_unavailable: {
        Args: {
          _error?: string
          _network: string
          _package_code: string
          _provider_code: string
        }
        Returns: undefined
      }
      mark_notification_read: { Args: { _id: string }; Returns: undefined }
      pause_schedule: { Args: { _id: string }; Returns: undefined }
      purchase_vtu: {
        Args: {
          _amount: number
          _meta?: Json
          _network: string
          _phone: string
          _type: Database["public"]["Enums"]["tx_type"]
        }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_treasury_transfer: {
        Args: {
          _account: string
          _amount: number
          _bank_code: string
          _kp_ref: string
          _provider: string
        }
        Returns: string
      }
      redeem_swift_points: {
        Args: { _network: string; _phone: string }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refund_wallet: {
        Args: { _amount: number; _ref: string; _user_id: string }
        Returns: undefined
      }
      release_provider_liquidity: {
        Args: { _outcome: string; _reservation_id: string }
        Returns: undefined
      }
      reserve_provider_liquidity: {
        Args: {
          _amount: number
          _provider: string
          _tx_ref: string
          _uid: string
        }
        Returns: string
      }
      resume_schedule: { Args: { _id: string }; Returns: undefined }
      revoke_api_key: {
        Args: { _key_id: string; _user_id: string }
        Returns: Json
      }
      search_transaction_by_reference: {
        Args: { _ref: string }
        Returns: {
          amount: number
          created_at: string
          meta: Json
          network: string
          phone: string
          reference: string
          status: string
          tx_id: string
          tx_type: string
          user_email: string
          user_name: string
        }[]
      }
      send_broadcast: {
        Args: { _message: string; _title: string; _type?: string }
        Returns: number
      }
      set_transaction_pin: { Args: { _pin: string }; Returns: boolean }
      topup_wallet: {
        Args: { _amount: number; _method: string }
        Returns: {
          aidapay_hash: string | null
          aidapay_status: string | null
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          last_recovery_at: string | null
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
          recovery_attempts: number | null
          reference: string
          retry_count: number
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_api_key_last_used: {
        Args: { _key_id: string }
        Returns: undefined
      }
      verify_api_key: {
        Args: { _api_key: string }
        Returns: {
          api_key_id: string
          is_active: boolean
          permissions: Json
          user_id: string
          wallet_discount_percent: number
        }[]
      }
      verify_transaction_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      schedule_frequency:
        | "once"
        | "daily"
        | "weekly"
        | "monthly"
        | "every_n_days"
        | "until_cancelled"
      schedule_status:
        | "active"
        | "paused"
        | "cancelled"
        | "completed"
        | "failed"
        | "needs_funding"
      tx_status:
        | "pending"
        | "success"
        | "failed"
        | "processing"
        | "verifying"
        | "escalated_manual_review"
        | "refunded"
        | "reversed"
      tx_type:
        | "airtime"
        | "data"
        | "wallet_topup"
        | "electricity"
        | "cable"
        | "wallet_fund"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      schedule_frequency: [
        "once",
        "daily",
        "weekly",
        "monthly",
        "every_n_days",
        "until_cancelled",
      ],
      schedule_status: [
        "active",
        "paused",
        "cancelled",
        "completed",
        "failed",
        "needs_funding",
      ],
      tx_status: [
        "pending",
        "success",
        "failed",
        "processing",
        "verifying",
        "escalated_manual_review",
        "refunded",
        "reversed",
      ],
      tx_type: [
        "airtime",
        "data",
        "wallet_topup",
        "electricity",
        "cable",
        "wallet_fund",
      ],
    },
  },
} as const
