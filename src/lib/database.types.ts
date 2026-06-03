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
          article_id: string;
          brief_id: string;
          category_slug: string | null;
          deep_dive_en: string | null;
          deep_dive_uk: string | null;
          id: string;
          rank: number;
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
          article_id: string;
          brief_id: string;
          category_slug?: string | null;
          deep_dive_en?: string | null;
          deep_dive_uk?: string | null;
          id?: string;
          rank: number;
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
          article_id?: string;
          brief_id?: string;
          category_slug?: string | null;
          deep_dive_en?: string | null;
          deep_dive_uk?: string | null;
          id?: string;
          rank?: number;
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
          category: string | null;
          created_at: string;
          description_en: string | null;
          description_uk: string | null;
          name_en: string;
          name_uk: string;
          official_url: string | null;
          slug: string;
          type: string;
        };
        Insert: {
          aliases?: string[] | null;
          category?: string | null;
          created_at?: string;
          description_en?: string | null;
          description_uk?: string | null;
          name_en: string;
          name_uk: string;
          official_url?: string | null;
          slug: string;
          type?: string;
        };
        Update: {
          aliases?: string[] | null;
          category?: string | null;
          created_at?: string;
          description_en?: string | null;
          description_uk?: string | null;
          name_en?: string;
          name_uk?: string;
          official_url?: string | null;
          slug?: string;
          type?: string;
        };
        Relationships: [];
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
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
