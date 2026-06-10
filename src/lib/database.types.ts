export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      articles: {
        Row: {
          composite_score: number | null;
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
          source_name: string;
          source_url: string;
          title: string;
          url: string;
        };
        Insert: {
          composite_score?: number | null;
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
          source_name: string;
          source_url: string;
          title: string;
          url: string;
        };
        Update: {
          composite_score?: number | null;
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
          brief_id: string;
          category_slug: string | null;
          deep_dive_en: string | null;
          deep_dive_uk: string | null;
          id: string;
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
          why_matters_en: string | null;
          why_matters_uk: string | null;
          youtube_url: string | null;
        };
        Insert: {
          action_items_en?: Json | null;
          action_items_uk?: Json | null;
          article_id: string;
          brief_id: string;
          category_slug?: string | null;
          deep_dive_en?: string | null;
          deep_dive_uk?: string | null;
          id?: string;
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
          why_matters_en?: string | null;
          why_matters_uk?: string | null;
          youtube_url?: string | null;
        };
        Update: {
          action_items_en?: Json | null;
          action_items_uk?: Json | null;
          article_id?: string;
          brief_id?: string;
          category_slug?: string | null;
          deep_dive_en?: string | null;
          deep_dive_uk?: string | null;
          id?: string;
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
        };
        Relationships: [];
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
      social_posts: {
        Row: {
          brief_id: string | null;
          brief_item_id: string | null;
          channel: string;
          created_at: string;
          external_id: string | null;
          id: string;
          meta: Json | null;
          posted_at: string | null;
          status: string;
          url: string | null;
        };
        Insert: {
          brief_id?: string | null;
          brief_item_id?: string | null;
          channel: string;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          meta?: Json | null;
          posted_at?: string | null;
          status?: string;
          url?: string | null;
        };
        Update: {
          brief_id?: string | null;
          brief_item_id?: string | null;
          channel?: string;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          meta?: Json | null;
          posted_at?: string | null;
          status?: string;
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
        ];
      };
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
