import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { MessageList } from "../features/messages/MessageList.jsx";

export default function ConversationPage() {
  const { conversationId } = useParams();
  const [conversation, setConversation] = useState(null);

  useEffect(() => {
    api
      .get(`/api/conversations/${conversationId}`)
      .then((data) => setConversation(data.conversation))
      .catch(() => setConversation(null));
  }, [conversationId]);

  return (
    <section className="conversation-view">
      <header className="conversation-header">
        <h2>{conversation?.name ?? "..."}</h2>
      </header>
      <MessageList conversationId={conversationId} />
    </section>
  );
}
