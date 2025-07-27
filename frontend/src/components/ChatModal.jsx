import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

// Use .env variable for backend chat API endpoint
const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || 'https://us-central1-legal-text-aggregator.cloudfunctions.net/getOpenAIReply';

function ChatModal({ billId, text = '', html = '', onClose }) { // Pass the actual bill text here
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [notes, setNotes] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  // ---> No initial loading state needed unless you fetch history from backend <---
  // Removed unused state: isLoadingChat
  const [isSending, setIsSending] = useState(false);

  const chatEndRef = useRef(null);

  // Optional: Add an initial assistant welcome message client-side
  useEffect(() => {
      setMessages([
          { role: 'assistant', content: `Hello! Ask me anything about bill ${billId}.` }
      ]);
  }, [billId]); // Run only when billId changes


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isSending) return;

    setIsSending(true);
    const userMessage = { role: 'user', content: trimmedInput };
    // Add user message optimistically AND include previous history for context
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput('');

    try {
      // --- Call Backend API Endpoint ---
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billText: text,
          messages: currentMessages
        }),
      });

      if (!response.ok) {
        // Try to get error message from backend response body
        let errorData;
        try {
            errorData = await response.json();
        } catch {
             // Ignore if body isn't valid JSON
        }
        throw new Error(errorData?.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json(); // Expecting { reply: "..." }

      if (!data.reply) {
        throw new Error("Received empty reply from assistant.");
      }

      // Add the assistant's response from the backend
      const assistantMessage = { role: 'assistant', content: data.reply };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Error sending message or getting reply:', err);
      // Add a system/error message to the chat
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${err.message || 'Could not get reply.'}` }]);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key press in chat input
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };


  // --- handleHighlight, handleAddNote, handleAddGeneralNote ---
  const handleHighlight = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.backgroundColor = 'yellow';
    span.className = 'text-highlight';
    try {
        range.surroundContents(span);
    } catch (e) {
        console.warn('Highlighting failed, possibly due to complex selection:', e);
    }
    selection.removeAllRanges();
  };

  const handleAddNote = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      alert('Please select text in the bill to add a note.');
      return;
    }
    const quote = selection.toString().trim();
    const noteText = prompt(`Enter note for selected text:\n\n"${quote}"`, '');
    if (noteText !== null && noteText.trim() !== '') {
      setNotes(prev => [...prev, { quote, text: noteText, timestamp: new Date().toLocaleString() }]);
      selection.removeAllRanges();
    } else if (noteText !== null) {
        alert("Note cannot be empty.");
    }
  };

  const handleAddGeneralNote = () => {
    const noteText = prompt('Enter general note:', '');
     if (noteText !== null && noteText.trim() !== '') {
      setNotes(prev => [...prev, { quote: '', text: noteText, timestamp: new Date().toLocaleString() }]);
     } else if (noteText !== null) {
        alert("Note cannot be empty.");
    }
  };


  // --- JSX Structure ---
  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">{billId}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full p-1 w-8 h-8 flex items-center justify-center" aria-label="Close modal">✕</button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Pane: Bill Viewer */}
          <div className="w-[65%] border-r border-gray-200 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex-shrink-0 flex gap-2 p-2 border-b bg-gray-50">
               {/* Buttons */}
              <button onClick={handleHighlight} title="Highlight Selection" className="p-1 hover:bg-gray-200 rounded text-lg">🖍️</button>
              <button onClick={handleAddNote} title="Add Note to Selection" className="p-1 hover:bg-gray-200 rounded text-lg">📝</button>
              <button onClick={() => setFontSize(sz => Math.max(12, sz - 1))} title="Decrease font size" className="p-1 hover:bg-gray-200 rounded text-lg">A-</button>
              <button onClick={() => setFontSize(sz => Math.min(24, sz + 1))} title="Increase font size" className="p-1 hover:bg-gray-200 rounded text-lg">A+</button>
              <button onClick={() => window.print()} title="Print" className="p-1 hover:bg-gray-200 rounded text-lg">🖨️</button>
              <button title="Download Original PDF" className="p-1 hover:bg-gray-200 rounded text-lg">📄</button>
            </div>
            {/* Bill Text Content Area */}
            <div className="flex-1 overflow-y-auto p-4">
              <div style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }} className="text-gray-800">
                {html ? (
                  <div 
                    className="prose max-w-none prose-headings:font-semibold prose-p:my-2 prose-ul:my-1 prose-ol:my-1"
                    dangerouslySetInnerHTML={{ __html: html }} 
                  />
                ) : (
                  <div className="whitespace-pre-wrap font-sans">
                    {text.split('\n').map((paragraph, i) => 
                      paragraph.trim() ? <p key={i} className="mb-3">{paragraph}</p> : <br key={i} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Pane: Interaction Panel */}
          <div className="w-[35%] flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex-shrink-0 flex border-b">
              <button onClick={() => setActiveTab('chat')} className={`flex-1 py-2 px-4 text-center text-sm font-medium ${activeTab === 'chat' ? 'border-b-2 border-brand-red-dark text-brand-red-dark' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Chat</button>
              <button onClick={() => setActiveTab('notes')} className={`flex-1 py-2 px-4 text-center text-sm font-medium ${activeTab === 'notes' ? 'border-b-2 border-brand-red-dark text-brand-red-dark' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>Notes</button>
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 flex flex-col overflow-y-auto p-3 bg-gray-50">
              {activeTab === 'chat' ? (
                <>
                  {/* Messages Area */}
                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                     {/* Removed isLoadingChat check for simplicity, relies on initial message now */}
                    {messages.length === 0 ? ( // Should ideally not happen with initial message
                      <div className="p-4 text-gray-500 italic text-center">Start the conversation below.</div>
                    ) : (
                      messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] py-2 px-3 rounded-lg shadow-sm ${
                              msg.role === 'user' ? 'bg-brand-red text-white' :
                              msg.role === 'assistant' ? 'bg-white text-gray-800 border border-gray-200' :
                              'bg-yellow-100 text-yellow-800 text-sm italic' // System/Error messages
                            }`}
                          >
                            {/* Basic sanitization or markdown rendering could be added here */}
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="flex-shrink-0 flex mt-2 pt-2 border-t border-gray-200">
                    <textarea
                      rows="1"
                      className="flex-1 p-2 border border-gray-300 rounded-md resize-none mr-2 focus:ring-brand-red focus:border-brand-red"
                      placeholder="Ask a question..."
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isSending}
                      style={{ minHeight: '40px', maxHeight: '120px' }}
                    />
                    <button
                      onClick={handleSend}
                      className={`px-4 py-2 rounded-md text-white font-semibold ${isSending ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-red hover:bg-brand-red-dark'}`}
                      disabled={isSending}
                    >
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </>
              ) : (
                 // Notes Tab Layout (remains the same)
                <>
                  <button onClick={handleAddGeneralNote} className="flex-shrink-0 mb-3 w-full px-3 py-2 bg-brand-red text-brand-red-dark rounded hover:bg-brand-red text-sm font-medium">Add General Note</button>
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                      {notes.length === 0 ? <div className="text-gray-500 text-center italic">No notes yet.</div> : notes.map((note, idx) => (
                        <div key={idx} className="p-3 border border-gray-200 rounded bg-white shadow-sm">
                          {/* Note content structure remains same */}
                          <div className="text-xs text-gray-500 mb-1">{note.timestamp}</div>
                          {note.quote && <blockquote className="border-l-4 border-gray-300 pl-2 italic text-sm text-gray-600 mb-1">“{note.quote}”</blockquote>}
                          <div className="text-sm text-gray-800">{note.text}</div>
                          <div className="flex gap-3 mt-2 pt-1 border-t border-gray-100 text-xs">
                             {/* Edit/Delete buttons remain same */}
                            <button className="text-blue-600 hover:underline" onClick={() => { /* Edit logic */ }}>Edit</button>
                            <button className="text-red-600 hover:underline" onClick={() => { /* Delete logic */ }}>Delete</button>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ChatModal;