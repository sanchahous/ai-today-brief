export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type CmsTable<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      articles: {
        Row: {
          composite_score: number | null;
          cluster_id: string | null;
          fetched_at: string | null;
          hn_comments: number | null;
          hn_score: number | null;
          id: string;
          inbrief_score: number | null;
          mentions_count: number | null;
          published_at: string;
          raw: Json | null;
          reddit_comments: number | null;
          reddit_score: number | null;
          score_authority: number | null;
          score_breadth: number | null;
          score_cross_source: number | null;
          score_inbrief: number | null;
          score_recency: number | null;
          score_velocity: number | null;
          score_version: number | null;
          scored_as_of: string | null;
          source_name: string;
          source_url: string;
          title: string;
          url: string;
        };
        Insert: {
          composite_score?: number | null;
          cluster_id?: string | null;
          fetched_at?: string | null;
          hn_comments?: number | null;
          hn_score?: number | null;
          id?: string;
          inbrief_score?: number | null;
          mentions_count?: number | null;
          published_at: string;
          raw?: Json | null;
          reddit_comments?: number | null;
          reddit_score?: number | null;
          score_authority?: number | null;
          score_breadth?: number | null;
          score_cross_source?: number | null;
          score_inbrief?: number | null;
          score_recency?: number | null;
          score_velocity?: number | null;
          score_version?: number | null;
          scored_as_of?: string | null;
          source_name: string;
          source_url: string;
          title: string;
          url: string;
        };
        Update: {
          composite_score?: number | null;
          cluster_id?: string | null;
          fetched_at?: string | null;
          hn_comments?: number | null;
          hn_score?: number | null;
          id?: string;
          inbrief_score?: number | null;
          mentions_count?: number | null;
          published_at?: string;
          raw?: Json | null;
          reddit_comments?: number | null;
          reddit_score?: number | null;
          score_authority?: number | null;
          score_breadth?: number | null;
          score_cross_source?: number | null;
          score_inbrief?: number | null;
          score_recency?: number | null;
          score_velocity?: number | null;
          score_version?: number | null;
          scored_as_of?: string | null;
          source_name?: string;
          source_url?: string;
          title?: string;
          url?: string;
        };
        Relationships: [];
      };
      brief_items: {
        Row: {
          action_items_en: Json | null;
          action_items_uk: Json | null;
          article_id: string;
          body_md_en: string | null;
          body_md_uk: string | null;
          brief_id: string;
          canonical_item_id: string | null;
          card_image_url: string | null;
          category_slug: string | null;
          citations: Json | null;
          code_snippet: Json | null;
          community_reactions: Json | null;
          deep_dive_en: string | null;
          deep_dive_uk: string | null;
          editor_take: string | null;
          facts_en: Json | null;
          facts_uk: Json | null;
          id: string;
          image_url: string | null;
          impact_level: string | null;
          rank: number;
          review_comment: string | null;
          review_msg_id: number | null;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          search_tsv_en: unknown;
          search_tsv_uk: unknown;
          slug: string | null;
          social_hook_en: string | null;
          social_hook_uk: string | null;
          summary_en: string;
          summary_uk: string;
          takeaways_en: Json | null;
          takeaways_uk: Json | null;
          title_en: string | null;
          title_uk: string | null;
          tools_mentioned: Json | null;
          video_script_en: Json | null;
          video_script_uk: Json | null;
          when_not_to_use_en: Json | null;
          when_not_to_use_uk: Json | null;
          when_to_use_en: Json | null;
          when_to_use_uk: Json | null;
          why_matters_en: string | null;
          why_matters_uk: string | null;
          youtube_url: string | null;
        };
        Insert: {
          action_items_en?: Json | null;
          action_items_uk?: Json | null;
          article_id: string;
          body_md_en?: string | null;
          body_md_uk?: string | null;
          brief_id: string;
          canonical_item_id?: string | null;
          card_image_url?: string | null;
          category_slug?: string | null;
          citations?: Json | null;
          code_snippet?: Json | null;
          community_reactions?: Json | null;
          deep_dive_en?: string | null;
          deep_dive_uk?: string | null;
          editor_take?: string | null;
          facts_en?: Json | null;
          facts_uk?: Json | null;
          id?: string;
          image_url?: string | null;
          impact_level?: string | null;
          rank: number;
          review_comment?: string | null;
          review_msg_id?: number | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          search_tsv_en?: unknown;
          search_tsv_uk?: unknown;
          slug?: string | null;
          social_hook_en?: string | null;
          social_hook_uk?: string | null;
          summary_en: string;
          summary_uk: string;
          takeaways_en?: Json | null;
          takeaways_uk?: Json | null;
          title_en?: string | null;
          title_uk?: string | null;
          tools_mentioned?: Json | null;
          video_script_en?: Json | null;
          video_script_uk?: Json | null;
          when_not_to_use_en?: Json | null;
          when_not_to_use_uk?: Json | null;
          when_to_use_en?: Json | null;
          when_to_use_uk?: Json | null;
          why_matters_en?: string | null;
          why_matters_uk?: string | null;
          youtube_url?: string | null;
        };
        Update: {
          action_items_en?: Json | null;
          action_items_uk?: Json | null;
          article_id?: string;
          body_md_en?: string | null;
          body_md_uk?: string | null;
          brief_id?: string;
          canonical_item_id?: string | null;
          card_image_url?: string | null;
          category_slug?: string | null;
          citations?: Json | null;
          code_snippet?: Json | null;
          community_reactions?: Json | null;
          deep_dive_en?: string | null;
          deep_dive_uk?: string | null;
          editor_take?: string | null;
          facts_en?: Json | null;
          facts_uk?: Json | null;
          id?: string;
          image_url?: string | null;
          impact_level?: string | null;
          rank?: number;
          review_comment?: string | null;
          review_msg_id?: number | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          search_tsv_en?: unknown;
          search_tsv_uk?: unknown;
          slug?: string | null;
          social_hook_en?: string | null;
          social_hook_uk?: string | null;
          summary_en?: string;
          summary_uk?: string;
          takeaways_en?: Json | null;
          takeaways_uk?: Json | null;
          title_en?: string | null;
          title_uk?: string | null;
          tools_mentioned?: Json | null;
          video_script_en?: Json | null;
          video_script_uk?: Json | null;
          when_not_to_use_en?: Json | null;
          when_not_to_use_uk?: Json | null;
          when_to_use_en?: Json | null;
          when_to_use_uk?: Json | null;
          why_matters_en?: string | null;
          why_matters_uk?: string | null;
          youtube_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'brief_items_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brief_items_canonical_item_id_fkey';
            columns: ['canonical_item_id'];
            isOneToOne: false;
            referencedRelation: 'brief_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brief_items_brief_id_fkey';
            columns: ['brief_id'];
            isOneToOne: false;
            referencedRelation: 'briefs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'brief_items_category_slug_fkey';
            columns: ['category_slug'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['slug'];
          },
        ];
      };
      briefs: {
        Row: {
          created_at: string | null;
          date: string;
          edition: number;
          generated_by: string | null;
          id: string;
          intro_en: string | null;
          intro_uk: string | null;
          published_at: string | null;
          slug: string | null;
          status: string;
          title_en: string;
          title_uk: string;
        };
        Insert: {
          created_at?: string | null;
          date: string;
          edition?: number;
          generated_by?: string | null;
          id?: string;
          intro_en?: string | null;
          intro_uk?: string | null;
          published_at?: string | null;
          slug?: string | null;
          status?: string;
          title_en: string;
          title_uk: string;
        };
        Update: {
          created_at?: string | null;
          date?: string;
          edition?: number;
          generated_by?: string | null;
          id?: string;
          intro_en?: string | null;
          intro_uk?: string | null;
          published_at?: string | null;
          slug?: string | null;
          status?: string;
          title_en?: string;
          title_uk?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string;
          description_en: string | null;
          description_uk: string | null;
          name_en: string;
          name_uk: string;
          position: number;
          slug: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description_en?: string | null;
          description_uk?: string | null;
          name_en: string;
          name_uk: string;
          position?: number;
          slug: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description_en?: string | null;
          description_uk?: string | null;
          name_en?: string;
          name_uk?: string;
          position?: number;
          slug?: string;
        };
        Relationships: [];
      };
      concepts: {
        Row: {
          aliases: string[] | null;
          body_en: string | null;
          body_uk: string | null;
          category: string | null;
          created_at: string;
          description_en: string | null;
          description_uk: string | null;
          faq_en: Json | null;
          faq_uk: Json | null;
          name_en: string;
          name_uk: string;
          official_url: string | null;
          slug: string;
          type: string;
          unverified_claims: Json | null;
          verification_status: string | null;
          verified_at: string | null;
        };
        Insert: {
          aliases?: string[] | null;
          body_en?: string | null;
          body_uk?: string | null;
          category?: string | null;
          created_at?: string;
          description_en?: string | null;
          description_uk?: string | null;
          faq_en?: Json | null;
          faq_uk?: Json | null;
          name_en: string;
          name_uk: string;
          official_url?: string | null;
          slug: string;
          type?: string;
          unverified_claims?: Json | null;
          verification_status?: string | null;
          verified_at?: string | null;
        };
        Update: {
          aliases?: string[] | null;
          body_en?: string | null;
          body_uk?: string | null;
          category?: string | null;
          created_at?: string;
          description_en?: string | null;
          description_uk?: string | null;
          faq_en?: Json | null;
          faq_uk?: Json | null;
          name_en?: string;
          name_uk?: string;
          official_url?: string | null;
          slug?: string;
          type?: string;
          unverified_claims?: Json | null;
          verification_status?: string | null;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      item_events: {
        Row: {
          brief_item_id: string | null;
          event_type: string;
          id: number;
          lang: string | null;
          session_hash: string | null;
          slug: string | null;
          ts: string;
          ua_class: string | null;
          value: number | null;
        };
        Insert: {
          brief_item_id?: string | null;
          event_type: string;
          id?: never;
          lang?: string | null;
          session_hash?: string | null;
          slug?: string | null;
          ts?: string;
          ua_class?: string | null;
          value?: number | null;
        };
        Update: {
          brief_item_id?: string | null;
          event_type?: string;
          id?: never;
          lang?: string | null;
          session_hash?: string | null;
          slug?: string | null;
          ts?: string;
          ua_class?: string | null;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'item_events_brief_item_id_fkey';
            columns: ['brief_item_id'];
            isOneToOne: false;
            referencedRelation: 'brief_items';
            referencedColumns: ['id'];
          },
        ];
      };
      item_metrics: {
        Row: {
          brief_item_id: string;
          dwell_ms_p50: number | null;
          expands: number | null;
          outbound: number | null;
          saves: number | null;
          scroll50: number | null;
          scroll90: number | null;
          shares: number | null;
          updated_at: string | null;
          views: number | null;
        };
        Insert: {
          brief_item_id: string;
          dwell_ms_p50?: number | null;
          expands?: number | null;
          outbound?: number | null;
          saves?: number | null;
          scroll50?: number | null;
          scroll90?: number | null;
          shares?: number | null;
          updated_at?: string | null;
          views?: number | null;
        };
        Update: {
          brief_item_id?: string;
          dwell_ms_p50?: number | null;
          expands?: number | null;
          outbound?: number | null;
          saves?: number | null;
          scroll50?: number | null;
          scroll90?: number | null;
          shares?: number | null;
          updated_at?: string | null;
          views?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'item_metrics_brief_item_id_fkey';
            columns: ['brief_item_id'];
            isOneToOne: true;
            referencedRelation: 'brief_items';
            referencedColumns: ['id'];
          },
        ];
      };
      item_reviews: {
        Row: {
          action: string;
          article_url: string | null;
          brief_id: string | null;
          brief_item_id: string | null;
          category_slug: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          model_output: Json | null;
          reviewer: string | null;
          summary_en: string | null;
          title_en: string | null;
        };
        Insert: {
          action: string;
          article_url?: string | null;
          brief_id?: string | null;
          brief_item_id?: string | null;
          category_slug?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          model_output?: Json | null;
          reviewer?: string | null;
          summary_en?: string | null;
          title_en?: string | null;
        };
        Update: {
          action?: string;
          article_url?: string | null;
          brief_id?: string | null;
          brief_item_id?: string | null;
          category_slug?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          model_output?: Json | null;
          reviewer?: string | null;
          summary_en?: string | null;
          title_en?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'item_reviews_brief_item_id_fkey';
            columns: ['brief_item_id'];
            isOneToOne: false;
            referencedRelation: 'brief_items';
            referencedColumns: ['id'];
          },
        ];
      };
      pipeline_runs: {
        Row: {
          created_at: string | null;
          date: string;
          duration_ms: number | null;
          error: string | null;
          id: string;
          meta: Json | null;
          stage: string;
          status: string;
        };
        Insert: {
          created_at?: string | null;
          date: string;
          duration_ms?: number | null;
          error?: string | null;
          id?: string;
          meta?: Json | null;
          stage: string;
          status: string;
        };
        Update: {
          created_at?: string | null;
          date?: string;
          duration_ms?: number | null;
          error?: string | null;
          id?: string;
          meta?: Json | null;
          stage?: string;
          status?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          author_name: string | null;
          body: string;
          brief_item_id: string;
          created_at: string;
          id: string;
          status: string;
          user_id: string | null;
        };
        Insert: {
          author_name?: string | null;
          body: string;
          brief_item_id: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          author_name?: string | null;
          body?: string;
          brief_item_id?: string;
          created_at?: string;
          id?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_brief_item_id_fkey';
            columns: ['brief_item_id'];
            isOneToOne: false;
            referencedRelation: 'brief_items';
            referencedColumns: ['id'];
          },
        ];
      };
      newsletter_sends: {
        Row: {
          beehiiv_post_id: string | null;
          brief_id: string | null;
          clicks: number | null;
          created_at: string;
          id: string;
          opens: number | null;
          recipients: number | null;
          segment: string;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          beehiiv_post_id?: string | null;
          brief_id?: string | null;
          clicks?: number | null;
          created_at?: string;
          id?: string;
          opens?: number | null;
          recipients?: number | null;
          segment?: string;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          beehiiv_post_id?: string | null;
          brief_id?: string | null;
          clicks?: number | null;
          created_at?: string;
          id?: string;
          opens?: number | null;
          recipients?: number | null;
          segment?: string;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'newsletter_sends_brief_id_fkey';
            columns: ['brief_id'];
            isOneToOne: false;
            referencedRelation: 'briefs';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          lang_pref: string | null;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          lang_pref?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          lang_pref?: string | null;
        };
        Relationships: [];
      };
      saved_items: {
        Row: {
          brief_item_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          brief_item_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          brief_item_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_items_brief_item_id_fkey';
            columns: ['brief_item_id'];
            isOneToOne: false;
            referencedRelation: 'brief_items';
            referencedColumns: ['id'];
          },
        ];
      };
      engagement_targets: CmsTable<
        {
          active: boolean;
          channel: string;
          created_at: string;
          handle: string;
          id: string;
          profile_url: string;
          rationale: string | null;
          updated_at: string;
        },
        {
          active?: boolean;
          channel: string;
          created_at?: string;
          handle: string;
          id?: string;
          profile_url: string;
          rationale?: string | null;
          updated_at?: string;
        }
      >;
      engagement_tasks: CmsTable<
        {
          action: string;
          channel: string;
          completed_at: string | null;
          created_at: string;
          due_at: string | null;
          id: string;
          native_url: string;
          rationale: string | null;
          status: string;
          suggested_text: string | null;
          target_id: string | null;
          updated_at: string;
        },
        {
          action: string;
          channel: string;
          completed_at?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          native_url: string;
          rationale?: string | null;
          status?: string;
          suggested_text?: string | null;
          target_id?: string | null;
          updated_at?: string;
        }
      >;
      social_accounts: CmsTable<
        {
          capabilities: Json;
          channel: string;
          connection_health: string;
          created_at: string;
          enabled: boolean;
          handle: string | null;
          id: string;
          last_alerted_at: string | null;
          last_checked_at: string | null;
          provider_account_id: string | null;
          secret_reference: string | null;
          token_expires_at: string | null;
          updated_at: string;
        },
        {
          capabilities?: Json;
          channel: string;
          connection_health?: string;
          created_at?: string;
          enabled?: boolean;
          handle?: string | null;
          id?: string;
          last_alerted_at?: string | null;
          last_checked_at?: string | null;
          provider_account_id?: string | null;
          secret_reference?: string | null;
          token_expires_at?: string | null;
          updated_at?: string;
        }
      >;
      social_account_metrics: CmsTable<
        {
          followers_count: number | null;
          id: number;
          measured_at: string;
          raw: Json;
          social_account_id: string;
        },
        {
          followers_count?: number | null;
          id?: never;
          measured_at?: string;
          raw?: Json;
          social_account_id: string;
        }
      >;
      social_admins: CmsTable<
        {
          created_at: string;
          enabled: boolean;
          role: string;
          user_id: string;
        },
        {
          created_at?: string;
          enabled?: boolean;
          role?: string;
          user_id: string;
        }
      >;
      social_click_events: CmsTable<
        {
          clicked_at: string;
          device_class: string | null;
          id: number;
          referrer_host: string | null;
          social_post_id: string;
        },
        {
          clicked_at?: string;
          device_class?: string | null;
          id?: never;
          referrer_host?: string | null;
          social_post_id: string;
        }
      >;
      social_delivery_attempts: CmsTable<
        {
          attempt_number: number;
          error_code: string | null;
          error_message: string | null;
          finished_at: string | null;
          id: number;
          idempotency_key: string | null;
          outcome: string;
          request_summary: Json;
          response_summary: Json;
          social_post_id: string;
          started_at: string;
        },
        {
          attempt_number: number;
          error_code?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: never;
          idempotency_key?: string | null;
          outcome?: string;
          request_summary?: Json;
          response_summary?: Json;
          social_post_id: string;
          started_at?: string;
        }
      >;
      social_packages: CmsTable<
        {
          created_at: string;
          generated_at: string;
          generation_version: string;
          green_success_counted_at: string | null;
          id: string;
          kind: string;
          risk_level: string;
          source_brief_id: string | null;
          source_brief_item_id: string | null;
          source_item_ids: string[];
          source_date: string | null;
          status: string;
          title: string;
          updated_at: string;
          weekly_digest_id: string | null;
        },
        {
          created_at?: string;
          generated_at?: string;
          generation_version?: string;
          green_success_counted_at?: string | null;
          id?: string;
          kind: string;
          risk_level: string;
          source_brief_id?: string | null;
          source_brief_item_id?: string | null;
          source_item_ids?: string[];
          source_date?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          weekly_digest_id?: string | null;
        }
      >;
      social_post_reviews: CmsTable<
        {
          action: string;
          content_hash: string | null;
          content_version: number;
          created_at: string;
          id: number;
          note: string | null;
          package_id: string | null;
          reviewer_id: string | null;
          snapshot: Json;
          social_post_id: string;
        },
        {
          action: string;
          content_hash?: string | null;
          content_version: number;
          created_at?: string;
          id?: never;
          note?: string | null;
          package_id?: string | null;
          reviewer_id?: string | null;
          snapshot: Json;
          social_post_id: string;
        }
      >;
      social_settings: CmsTable<
        {
          auto_publish_green: boolean;
          cadence: Json;
          channel_enabled: Json;
          global_kill_switch: boolean;
          green_success_count: number;
          id: boolean;
          updated_at: string;
          updated_by: string | null;
          x_budget_month: string;
          x_monthly_budget_eur: number;
          x_monthly_spend_eur: number;
        },
        {
          auto_publish_green?: boolean;
          cadence?: Json;
          channel_enabled?: Json;
          global_kill_switch?: boolean;
          green_success_count?: number;
          id?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          x_budget_month?: string;
          x_monthly_budget_eur?: number;
          x_monthly_spend_eur?: number;
        }
      >;
      social_posts: {
        Row: {
          alt_text: string | null;
          approval_version: number | null;
          approved_at: string | null;
          approved_by: string | null;
          asset_urls: Json;
          attempts: number;
          brief_id: string | null;
          brief_item_id: string | null;
          channel: string;
          content_hash: string | null;
          content_version: number;
          created_at: string;
          external_id: string | null;
          first_comment: string | null;
          format: string | null;
          id: string;
          idempotency_key: string | null;
          last_error: string | null;
          locale: string | null;
          meta: Json | null;
          package_id: string | null;
          posted_at: string | null;
          post_text: string | null;
          provider_meta: Json;
          publishing_started_at: string | null;
          quality_report: Json;
          retry_after: string | null;
          scheduled_for: string | null;
          status: string;
          tracking_token: string;
          utm_url: string | null;
          url: string | null;
        };
        Insert: {
          alt_text?: string | null;
          approval_version?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          asset_urls?: Json;
          attempts?: number;
          brief_id?: string | null;
          brief_item_id?: string | null;
          channel: string;
          content_hash?: string | null;
          content_version?: number;
          created_at?: string;
          external_id?: string | null;
          first_comment?: string | null;
          format?: string | null;
          id?: string;
          idempotency_key?: string | null;
          last_error?: string | null;
          locale?: string | null;
          meta?: Json | null;
          package_id?: string | null;
          posted_at?: string | null;
          post_text?: string | null;
          provider_meta?: Json;
          publishing_started_at?: string | null;
          quality_report?: Json;
          retry_after?: string | null;
          scheduled_for?: string | null;
          status?: string;
          tracking_token?: string;
          utm_url?: string | null;
          url?: string | null;
        };
        Update: {
          alt_text?: string | null;
          approval_version?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          asset_urls?: Json;
          attempts?: number;
          brief_id?: string | null;
          brief_item_id?: string | null;
          channel?: string;
          content_hash?: string | null;
          content_version?: number;
          created_at?: string;
          external_id?: string | null;
          first_comment?: string | null;
          format?: string | null;
          id?: string;
          idempotency_key?: string | null;
          last_error?: string | null;
          locale?: string | null;
          meta?: Json | null;
          package_id?: string | null;
          posted_at?: string | null;
          post_text?: string | null;
          provider_meta?: Json;
          publishing_started_at?: string | null;
          quality_report?: Json;
          retry_after?: string | null;
          scheduled_for?: string | null;
          status?: string;
          tracking_token?: string;
          utm_url?: string | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'social_posts_brief_id_fkey';
            columns: ['brief_id'];
            isOneToOne: false;
            referencedRelation: 'briefs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'social_posts_brief_item_id_fkey';
            columns: ['brief_item_id'];
            isOneToOne: false;
            referencedRelation: 'brief_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'social_posts_package_id_fkey';
            columns: ['package_id'];
            isOneToOne: false;
            referencedRelation: 'social_packages';
            referencedColumns: ['id'];
          },
        ];
      };
      social_post_metrics: {
        Row: {
          clicks: number | null;
          comments: number | null;
          engagements: number | null;
          id: number;
          impressions: number | null;
          likes: number | null;
          measured_at: string;
          raw: Json;
          reach: number | null;
          saves: number | null;
          shares: number | null;
          social_post_id: string;
        };
        Insert: {
          clicks?: number | null;
          comments?: number | null;
          engagements?: number | null;
          id?: never;
          impressions?: number | null;
          likes?: number | null;
          measured_at?: string;
          raw?: Json;
          reach?: number | null;
          saves?: number | null;
          shares?: number | null;
          social_post_id: string;
        };
        Update: {
          clicks?: number | null;
          comments?: number | null;
          engagements?: number | null;
          id?: never;
          impressions?: number | null;
          likes?: number | null;
          measured_at?: string;
          raw?: Json;
          reach?: number | null;
          saves?: number | null;
          shares?: number | null;
          social_post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'social_post_metrics_social_post_id_fkey';
            columns: ['social_post_id'];
            isOneToOne: false;
            referencedRelation: 'social_posts';
            referencedColumns: ['id'];
          },
        ];
      };
      weekly_digest_review_items: CmsTable<
        {
          action: string;
          brief_item_id: string | null;
          candidate_snapshot: Json;
          created_at: string;
          id: string;
          note: string | null;
          previous_rank: number | null;
          reason_codes: string[];
          requested_rank: number | null;
          review_id: string;
        },
        {
          action: string;
          brief_item_id?: string | null;
          candidate_snapshot?: Json;
          created_at?: string;
          id?: string;
          note?: string | null;
          previous_rank?: number | null;
          reason_codes?: string[];
          requested_rank?: number | null;
          review_id: string;
        }
      >;
      weekly_digest_reviews: CmsTable<
        {
          action: string;
          created_at: string;
          digest_snapshot: Json;
          id: string;
          note: string | null;
          package_id: string | null;
          parent_review_id: string | null;
          reason_codes: string[];
          reviewer_id: string | null;
          selection_run_id: string | null;
          weekly_digest_id: string;
        },
        {
          action: string;
          created_at?: string;
          digest_snapshot?: Json;
          id?: string;
          note?: string | null;
          package_id?: string | null;
          parent_review_id?: string | null;
          reason_codes?: string[];
          reviewer_id?: string | null;
          selection_run_id?: string | null;
          weekly_digest_id: string;
        }
      >;
      weekly_digest_selection_runs: CmsTable<
        {
          algorithm_version: string;
          candidate_count: number;
          candidate_pool: Json;
          created_at: string;
          eligible_count: number;
          id: string;
          rationale: Json;
          rationale_version: string;
          rejected_count: number;
          selected_count: number;
          week_end: string;
          week_start: string;
          weekly_digest_id: string;
        },
        {
          algorithm_version: string;
          candidate_count: number;
          candidate_pool: Json;
          created_at?: string;
          eligible_count: number;
          id?: string;
          rationale: Json;
          rationale_version: string;
          rejected_count: number;
          selected_count: number;
          week_end: string;
          week_start: string;
          weekly_digest_id: string;
        }
      >;
      weekly_digest_items: CmsTable<
        {
          brief_item_id: string;
          created_at: string;
          rank: number;
          snapshot: Json;
          weekly_digest_id: string;
        },
        {
          brief_item_id: string;
          created_at?: string;
          rank: number;
          snapshot?: Json;
          weekly_digest_id: string;
        }
      >;
      weekly_digests: CmsTable<
        {
          created_at: string;
          id: string;
          intro_en: string | null;
          intro_uk: string | null;
          published_at: string | null;
          slug: string;
          status: string;
          title_en: string;
          title_uk: string;
          updated_at: string;
          week_start: string;
        },
        {
          created_at?: string;
          id?: string;
          intro_en?: string | null;
          intro_uk?: string | null;
          published_at?: string | null;
          slug: string;
          status?: string;
          title_en: string;
          title_uk: string;
          updated_at?: string;
          week_start: string;
        }
      >;
      sponsor_placements: {
        Row: {
          active: boolean;
          body_en: string | null;
          body_uk: string | null;
          clicks: number;
          created_at: string;
          cta_en: string | null;
          cta_uk: string | null;
          ends_on: string;
          headline_en: string | null;
          headline_uk: string | null;
          id: string;
          impressions: number;
          lang: string;
          slot: string;
          sponsor_id: string;
          starts_on: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          active?: boolean;
          body_en?: string | null;
          body_uk?: string | null;
          clicks?: number;
          created_at?: string;
          cta_en?: string | null;
          cta_uk?: string | null;
          ends_on: string;
          headline_en?: string | null;
          headline_uk?: string | null;
          id?: string;
          impressions?: number;
          lang?: string;
          slot: string;
          sponsor_id: string;
          starts_on: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          active?: boolean;
          body_en?: string | null;
          body_uk?: string | null;
          clicks?: number;
          created_at?: string;
          cta_en?: string | null;
          cta_uk?: string | null;
          ends_on?: string;
          headline_en?: string | null;
          headline_uk?: string | null;
          id?: string;
          impressions?: number;
          lang?: string;
          slot?: string;
          sponsor_id?: string;
          starts_on?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sponsor_placements_sponsor_id_fkey';
            columns: ['sponsor_id'];
            isOneToOne: false;
            referencedRelation: 'sponsors';
            referencedColumns: ['id'];
          },
        ];
      };
      sponsors: {
        Row: {
          brand: string;
          color: string | null;
          contact_email: string | null;
          created_at: string;
          id: string;
          logo_url: string | null;
          notes: string | null;
        };
        Insert: {
          brand: string;
          color?: string | null;
          contact_email?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          notes?: string | null;
        };
        Update: {
          brand?: string;
          color?: string | null;
          contact_email?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      subscribers: {
        Row: {
          beehiiv_id: string | null;
          confirmed_at: string | null;
          created_at: string;
          email: string;
          id: string;
          ip_country: string | null;
          lang: string;
          placement: string | null;
          referral_code: string | null;
          referred_by: string | null;
          segment: string;
          social_post_id: string | null;
          source: string | null;
          status: string;
          unsubscribed_at: string | null;
          updated_at: string;
        };
        Insert: {
          beehiiv_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          ip_country?: string | null;
          lang?: string;
          placement?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          segment?: string;
          social_post_id?: string | null;
          source?: string | null;
          status?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          beehiiv_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          ip_country?: string | null;
          lang?: string;
          placement?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          segment?: string;
          social_post_id?: string | null;
          source?: string | null;
          status?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscribers_referred_by_fkey';
            columns: ['referred_by'];
            isOneToOne: false;
            referencedRelation: 'subscribers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_social_package: {
        Args: { p_package_id: string };
        Returns: number;
      };
      address_weekly_digest_changes: {
        Args: { p_note?: string | null; p_package_id: string };
        Returns: string;
      };
      auto_approve_green_package: {
        Args: { p_package_id: string };
        Returns: boolean;
      };
      approve_social_post: {
        Args: { p_social_post_id: string };
        Returns: Database['public']['Tables']['social_posts']['Row'];
      };
      claim_due_social_posts: {
        Args: { p_limit?: number };
        Returns: Database['public']['Tables']['social_posts']['Row'][];
      };
      edit_social_post: {
        Args: {
          p_alt_text: string;
          p_content_hash: string;
          p_expected_version: number;
          p_first_comment: string;
          p_post_text: string;
          p_quality_report: Json;
          p_scheduled_for: string;
          p_social_post_id: string;
        };
        Returns: Database['public']['Tables']['social_posts']['Row'];
      };
      has_social_aal2: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_social_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      reconcile_stale_social_posts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      reserve_x_budget: {
        Args: { p_amount: number };
        Returns: boolean;
      };
      record_green_delivery_success: {
        Args: { p_package_id: string };
        Returns: boolean;
      };
      request_weekly_digest_changes: {
        Args: {
          p_item_feedback?: Json;
          p_note: string;
          p_package_id: string;
          p_reason_codes: string[];
        };
        Returns: string;
      };
      read_social_oauth_secret: {
        Args: { p_channel: string };
        Returns: string | null;
      };
      store_social_oauth_secret: {
        Args: {
          p_channel: string;
          p_expires_at: string;
          p_provider_account_id?: string | null;
          p_secret: string;
        };
        Returns: undefined;
      };
      search_brief_items: {
        Args: {
          p_categories?: string[];
          p_from_date?: string;
          p_lang?: string;
          p_limit?: number;
          p_offset?: number;
          p_query: string;
          p_sort?: string;
          p_to_date?: string;
        };
        Returns: {
          brief_date: string;
          brief_id: string;
          brief_slug: string;
          category_slug: string;
          id: string;
          rank: number;
          rank_score: number;
          slug: string;
          source_name: string;
          summary_en: string;
          summary_uk: string;
          title_en: string;
          title_uk: string;
          total_count: number;
        }[];
      };
      search_facets: {
        Args: {
          p_from_date?: string;
          p_lang?: string;
          p_query: string;
          p_to_date?: string;
        };
        Returns: {
          category_slug: string;
          count: number;
        }[];
      };
      show_limit: { Args: Record<PropertyKey, never>; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
      get_concept_items: {
        Args: {
          p_concept_slug: string;
          p_lang?: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          rank: number;
          slug: string;
          category_slug: string;
          title_en: string;
          title_uk: string;
          summary_en: string;
          summary_uk: string;
          why_en: string;
          why_uk: string;
          has_video: boolean;
          tools_mentioned: Json;
          brief_slug: string;
          brief_date: string;
          source_name: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
