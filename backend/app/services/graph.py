import uuid
from typing import Any, Dict, List
from app.core.logging import get_logger
from app.core.database import get_supabase

logger = get_logger("varinth.graph")

class GraphService:
    """
    GraphService maintains the Knowledge Graph of claims, evidence, runs,
    and codebase files relational connections inside Supabase Postgres.
    """
    def __init__(self) -> None:
        self._db = get_supabase()

    def upsert_node(self, node_id: str, node_type: str, label: str, properties: Dict[str, Any] = None) -> None:
        """Create or update a graph node in PostgreSQL."""
        try:
            self._db.table("graph_nodes").upsert({
                "node_id": node_id,
                "node_type": node_type,
                "label": label,
                "properties_json": properties or {},
            }).execute()
        except Exception as exc:
            logger.error("graph_node_upsert_failed", node_id=node_id, error=str(exc))

    def upsert_edge(self, source_id: str, target_id: str, edge_type: str, properties: Dict[str, Any] = None) -> None:
        """Create or update a directed graph edge in PostgreSQL."""
        try:
            self._db.table("graph_edges").upsert({
                "source_id": source_id,
                "target_id": target_id,
                "edge_type": edge_type,
                "properties_json": properties or {},
            }, on_conflict="source_id,target_id,edge_type").execute()
        except Exception as exc:
            logger.error("graph_edge_upsert_failed", source=source_id, target=target_id, error=str(exc))

    async def record_audit_graph(
        self,
        audit_run_id: str,
        project_slug: str,
        claims_out: List[Dict[str, Any]],
    ) -> None:
        """Populate the audit trace graph representation in the database."""
        try:
            nodes_dict: Dict[str, Dict[str, Any]] = {}
            edges_dict: Dict[tuple, Dict[str, Any]] = {}

            def add_node(node_id: str, node_type: str, label: str, properties: Dict[str, Any] = None):
                nodes_dict[node_id] = {
                    "node_id": node_id,
                    "node_type": node_type,
                    "label": label,
                    "properties_json": properties or {},
                }

            def add_edge(source_id: str, target_id: str, edge_type: str, properties: Dict[str, Any] = None):
                key = (source_id, target_id, edge_type)
                edges_dict[key] = {
                    "source_id": source_id,
                    "target_id": target_id,
                    "edge_type": edge_type,
                    "properties_json": properties or {},
                }

            # 1. Project node
            add_node(
                node_id=f"project:{project_slug}",
                node_type="Project",
                label=project_slug,
            )

            # 2. AuditRun node
            add_node(
                node_id=f"run:{audit_run_id}",
                node_type="AuditRun",
                label=f"Audit Run {audit_run_id[:8]}",
                properties={"audit_run_id": audit_run_id},
            )
            add_edge(f"run:{audit_run_id}", f"project:{project_slug}", "BELONGS_TO")

            for c in claims_out:
                claim_index = c["claim_index"]
                claim_node_id = f"claim:{audit_run_id}:{claim_index}"

                # 3. Claim node
                add_node(
                    node_id=claim_node_id,
                    node_type="Claim",
                    label=c["normalized_text"][:50],
                    properties={
                        "claim_index": claim_index,
                        "raw_text": c["raw_text"],
                        "normalized_text": c["normalized_text"],
                        "verdict": c["verdict"],
                        "importance": c["importance"],
                    },
                )
                add_edge(claim_node_id, f"run:{audit_run_id}", "DERIVED_FROM")

                # 4. Evidence nodes
                for idx, ev in enumerate(c.get("evidence", [])):
                    source_id = ev.get("source_id", "unknown")
                    file_node_id = f"file:{project_slug}:{source_id}"

                    # Source File node
                    add_node(
                        node_id=file_node_id,
                        node_type="SourceFile",
                        label=source_id,
                    )
                    add_edge(file_node_id, f"project:{project_slug}", "BELONGS_TO")

                    evidence_node_id = f"evidence:{audit_run_id}:{claim_index}:{idx}"
                    add_node(
                        node_id=evidence_node_id,
                        node_type="Evidence",
                        label=f"Snippet {idx+1}",
                        properties={
                            "snippet": ev.get("snippet"),
                            "location": ev.get("location"),
                            "relevance_score": ev.get("relevance_score"),
                        },
                    )
                    add_edge(evidence_node_id, file_node_id, "BELONGS_TO")

                    # Link Evidence to Claim (SUPPORTS, CONTRADICTS, or MENTIONS)
                    edge_type = "MENTIONS"
                    if ev.get("supports_claim") is True:
                        edge_type = "SUPPORTS"
                    elif ev.get("contradicts_claim") is True:
                        edge_type = "CONTRADICTS"

                    add_edge(evidence_node_id, claim_node_id, edge_type)

            # Perform single batch upsert for nodes and edges
            nodes = list(nodes_dict.values())
            edges = list(edges_dict.values())

            if nodes:
                self._db.table("graph_nodes").upsert(nodes).execute()
            if edges:
                self._db.table("graph_edges").upsert(edges, on_conflict="source_id,target_id,edge_type").execute()

            logger.info("graph_audit_registered", audit_run_id=audit_run_id)

        except Exception as exc:
            logger.error("graph_audit_registration_failed", error=str(exc))
