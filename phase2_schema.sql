-- Varinth Phase 2 SQL Database Migrations

-- 1. Create memories table for agentic long-term memory
CREATE TABLE IF NOT EXISTS public.memories (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_slug TEXT NOT NULL,
    claim_text TEXT NOT NULL,
    verdict TEXT NOT NULL,
    explanation TEXT,
    properties_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast search matching on similar claims
CREATE INDEX IF NOT EXISTS idx_memories_claim_text ON public.memories USING gin (to_tsvector('english', claim_text));
CREATE INDEX IF NOT EXISTS idx_memories_project_slug ON public.memories (project_slug);

-- Enable RLS for memories
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on memories" 
    ON public.memories 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow read-only public access on memories" 
    ON public.memories 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);


-- 2. Create Knowledge Graph Nodes table
CREATE TABLE IF NOT EXISTS public.graph_nodes (
    node_id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL,
    label TEXT NOT NULL,
    properties_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON public.graph_nodes (node_type);

-- Enable RLS for graph_nodes
ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on graph_nodes" 
    ON public.graph_nodes 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow read-only public access on graph_nodes" 
    ON public.graph_nodes 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);


-- 3. Create Knowledge Graph Edges table
CREATE TABLE IF NOT EXISTS public.graph_edges (
    edge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL REFERENCES public.graph_nodes(node_id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES public.graph_nodes(node_id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL,
    properties_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_source_target_type UNIQUE (source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON public.graph_edges (source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON public.graph_edges (target_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_type ON public.graph_edges (edge_type);

-- Enable RLS for graph_edges
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on graph_edges" 
    ON public.graph_edges 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow read-only public access on graph_edges" 
    ON public.graph_edges 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);
