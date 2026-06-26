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
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
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
          last_verification_at?: string | null
          meta?: Json | null
          network?: string | null
          phone?: string | null
          provider_reference?: string | null
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
          last_verification_at?: string | null
          meta?: Json | null
          network?: string | null
          phone?: string | null
          provider_reference?: string | null
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
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          profit_balance?: number
          refund_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          profit_balance?: number
          refund_balance?: number
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
      complete_vtu_transaction: {
        Args: { _aidapay_hash: string; _meta?: Json; _status: string }
        Returns: undefined
      }
      confirm_treasury_transfer: {
        Args: { _new_balance: number; _transfer_id: string }
        Returns: undefined
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
              last_verification_at: string | null
              meta: Json | null
              network: string | null
              phone: string | null
              provider_reference: string | null
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
              last_verification_at: string | null
              meta: Json | null
              network: string | null
              phone: string | null
              provider_reference: string | null
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
      credit_wallet_from_korapay: {
        Args: { _amount: number; _korapay_ref: string; _user_id: string }
        Returns: undefined
      }
      credit_wallet_from_payvessel: {
        Args: { _amount: number; _pv_ref: string; _user_id: string }
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
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
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
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
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
          last_verification_at: string | null
          meta: Json | null
          network: string | null
          phone: string | null
          provider_reference: string | null
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
      verify_transaction_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
