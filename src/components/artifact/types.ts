export type ArtifactType =
  | "code"
  | "markdown"
  | "html"
  | "svg"
  | "mermaid"
  | "react";

export interface Artifact {
  id: string;
  message_id: string;
  chat_id: string;
  type: ArtifactType;
  title: string;
  language: string | null;
  content: string;
  version: number;
  parent_artifact_id: string | null;
  created_at: string;
}

export interface ArtifactVersion {
  id: string;
  version: number;
  created_at: string;
  message_id: string;
}
