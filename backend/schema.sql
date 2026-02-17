-- Create ticker_groups table
CREATE TABLE IF NOT EXISTS public.ticker_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    valid_from DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create ticker_group_members table
CREATE TABLE IF NOT EXISTS public.ticker_group_members (
    group_id UUID NOT NULL REFERENCES public.ticker_groups(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    PRIMARY KEY (group_id, ticker)
);

-- Enable RLS (Row Level Security) if needed, otherwise just grant access
-- Grant access to authenticated users or anon as per your current Supabase setup
ALTER TABLE public.ticker_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticker_group_members ENABLE ROW LEVEL SECURITY;

-- Simple policy for development (allow all for everyone - adjust according to your security needs)
CREATE POLICY "Allow all for authenticated" ON public.ticker_groups FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated members" ON public.ticker_group_members FOR ALL USING (true);
