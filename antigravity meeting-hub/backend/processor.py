import re
from typing import List, Dict, Any

class MeetingProcessor:
    def __init__(self, transcript: str, filename: str):
        self.raw_transcript = transcript
        self.filename = filename
        self.processed_transcript = self._pre_process(transcript)
        self.lines = [line.strip() for line in self.processed_transcript.split("\n") if line.strip()]

    def _pre_process(self, text: str) -> str:
        # Remove VTT/SRT timestamps: e.g. 00:00:00.000 --> 00:00:05.000
        # and standard timestamp formats like [00:00:05]
        cleaned = re.sub(r'(\d{2}:\d{2}:\d{2}[\.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[\.,]\d{3})', '', text)
        cleaned = re.sub(r'(\d{2}:\d{2}:\d{2}\s+-->\s+\d{2}:\d{2}:\d{2})', '', cleaned)
        cleaned = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', cleaned)
        # Remove common WebVTT headers
        cleaned = re.sub(r'^WEBVTT.*$', '', cleaned, flags=re.MULTILINE)
        return cleaned

    def get_basic_info(self) -> Dict[str, Any]:
        words = self.processed_transcript.split()
        speakers = set()
        # Regex to detect speaker names like "Sarah:", "Speaker 1:", "[Sarah]"
        speaker_regex = re.compile(r'^([A-Z][a-zA-Z\s]+|Speaker\s\d+):')
        for line in self.lines:
            match = speaker_regex.match(line)
            if match:
                speakers.add(match.group(1))
        
        return {
            "filename": self.filename,
            "word_count": len(words),
            "speaker_count": len(speakers) if speakers else 1
        }

    def generate_overview(self) -> str:
        # Extracts 4-6 sentences to form an overview
        # If the transcript is short, return all meaningful lines
        meaningful_lines = [l for l in self.lines if len(l) > 20]
        if not meaningful_lines:
            return "This meeting transcript was successfully uploaded and processed, though it contains limited dialogue for a detailed summary."
        
        summary_sentences = meaningful_lines[:min(6, len(meaningful_lines))]
        # Clean them up for a cohesive paragraph
        cleaned_summary = " ".join([re.sub(r'^[A-Z][a-zA-Z\s]+:\s*', '', s) for s in summary_sentences])
        return cleaned_summary

    def extract_decisions(self) -> List[str]:
        decision_keywords = ["we will", "decision", "agreed", "let's", "finalize", "plan is"]
        decisions = []
        for line in self.lines:
            if any(kw in line.lower() for kw in decision_keywords):
                cleaned_line = re.sub(r'^[A-Z][a-zA-Z\s]+:\s*', '', line)
                decisions.append(cleaned_line)
        return list(set(decisions))[:10]  # Limit to 10 unique decisions

    def extract_action_items(self) -> List[Dict[str, str]]:
        # Example pattern: Sarah: I will finish the authentication module by Friday
        action_items = []
        # Look for "I will", "will", "assigned to", etc.
        action_regex = re.compile(r'^([A-Z][a-zA-Z\s]+):\s*(.*(will|tasked to|assigned to|action|deliver).*)', re.IGNORECASE)
        for line in self.lines:
            match = action_regex.match(line)
            if match:
                person = match.group(1)
                task_text = match.group(2)
                # Simple deadline extraction like "by Friday", "by tomorrow"
                deadline_match = re.search(r'by\s+(\w+)', task_text, re.IGNORECASE)
                deadline = deadline_match.group(1) if deadline_match else "N/A"
                action_items.append({
                    "person": person,
                    "task": task_text,
                    "deadline": deadline
                })
        return action_items

    def analyze_sentiment(self) -> Dict[str, Any]:
        positive_words = ["good", "great", "excellent", "agree", "perfect", "happy", "yes"]
        negative_words = ["problem", "issue", "slow", "delay", "concern", "error", "no", "fail"]
        
        pos_count = 0
        neg_count = 0
        total_meaningful = 0
        
        for line in self.lines:
            words = line.lower().split()
            line_pos = sum(1 for w in words if w in positive_words)
            line_neg = sum(1 for w in words if w in negative_words)
            pos_count += line_pos
            neg_count += line_neg
            if line_pos or line_neg:
                total_meaningful += 1

        total_words = pos_count + neg_count
        if total_words == 0:
            return {"overall": "Neutral", "positive_pct": 0, "negative_pct": 0, "neutral_pct": 100}

        pos_pct = round((pos_count / (pos_count + neg_count)) * 100)
        neg_pct = 100 - pos_pct
        
        overall = "Positive" if pos_count > neg_count else "Negative" if neg_count > pos_count else "Neutral"
        
        return {
            "overall": overall,
            "positive_pct": pos_pct,
            "negative_pct": neg_pct,
            "neutral_pct": 0 if (pos_pct + neg_pct) > 0 else 100
        }

    def chat_query(self, query: str) -> Dict[str, str]:
        # Basic keyword search to find relevant context
        query_words = query.lower().split()
        best_match = ""
        max_overlap = 0
        line_index = -1
        
        for i, line in enumerate(self.lines):
            overlap = sum(1 for w in query_words if w in line.lower())
            if overlap > max_overlap:
                max_overlap = overlap
                best_match = line
                line_index = i
        
        if max_overlap == 0:
            return {
                "answer": "I couldn't find specific information regarding that in the transcript.",
                "source": "N/A"
            }
        
        # Give context of the line around the match
        context_start = max(0, line_index - 1)
        context_end = min(len(self.lines), line_index + 2)
        source_context = "\n".join(self.lines[context_start:context_end])
        
        return {
            "answer": best_match,
            "source": f"Section near: '{best_match[:50]}...'"
        }
