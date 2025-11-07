import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, User, Calendar } from "lucide-react";
import { format } from "date-fns";

const TEAM_MEMBERS = [
  "Sarah Johnson - Clinical Lead",
  "Michael Davis - Marketing Director", 
  "Jennifer Wilson - Clinical Scheduler",
  "Lisa Thompson - Training Coordinator",
  "David Brown - Operations Manager"
];

export default function ClientMessages({ clientId }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      to: "Sarah Johnson - Clinical Lead",
      from: "Current User",
      subject: "Background check status update needed",
      message: "Hi Sarah, can you provide an update on the background check progress for this client? The caregiver is eager to start training.",
      timestamp: new Date("2024-01-21T09:15:00"),
      status: "sent"
    },
    {
      id: 2,
      to: "Michael Davis - Marketing Director",
      from: "Current User", 
      subject: "Client satisfaction follow-up",
      message: "Michael, this client was referred through your network. They seem very satisfied with the initial process. Great work on the referral!",
      timestamp: new Date("2024-01-22T16:30:00"),
      status: "sent"
    }
  ]);
  
  const [newMessage, setNewMessage] = useState({
    to: '',
    subject: '',
    message: ''
  });
  const [isComposing, setIsComposing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (newMessage.to && newMessage.subject.trim() && newMessage.message.trim()) {
      setIsSending(true);
      
      // Simulate sending message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const message = {
        id: Date.now(),
        to: newMessage.to,
        from: "Current User",
        subject: newMessage.subject.trim(),
        message: newMessage.message.trim(),
        timestamp: new Date(),
        status: "sent"
      };
      
      setMessages([message, ...messages]);
      setNewMessage({ to: '', subject: '', message: '' });
      setIsComposing(false);
      setIsSending(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-700';
      case 'read':
        return 'bg-brand/10 text-heading-primary';
      default:
        return 'bg-light-chip text-heading-subdued';
    }
  };

  return (
    <div className="space-y-6">
      {/* Compose New Message */}
      <Card className="bg-hero-card backdrop-blur-sm border border-[rgba(147,165,197,0.2)] shadow-card rounded-2xl">
        <CardHeader className="p-6">
          <CardTitle className="text-heading-primary text-xl flex items-center justify-between">
            <span className="flex items-center gap-3">
              <Send className="w-5 h-5" />
              Send Team Message
            </span>
            {!isComposing && (
              <Button
                onClick={() => setIsComposing(true)}
                variant="default"
                size="sm"
                borderRadius="999px"
                className="gap-2 px-5"
              >
                <Send className="w-4 h-4 mr-2" />
                New Message
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        {isComposing && (
          <CardContent className="p-6 pt-0">
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-heading-subdued font-medium">To:</label>
                  <Select value={newMessage.to} onValueChange={(value) => setNewMessage({...newMessage, to: value})}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_MEMBERS.map((member) => (
                        <SelectItem key={member} value={member}>
                          {member}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-heading-subdued font-medium">Subject:</label>
                  <Input
                    value={newMessage.subject}
                    onChange={(e) => setNewMessage({...newMessage, subject: e.target.value})}
                    placeholder="Message subject"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-heading-subdued font-medium">Message:</label>
                <Textarea
                  value={newMessage.message}
                  onChange={(e) => setNewMessage({...newMessage, message: e.target.value})}
                  placeholder="Type your message here..."
                  className="rounded-xl h-32"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  borderRadius="1rem"
                  onClick={() => {
                    setIsComposing(false);
                    setNewMessage({ to: '', subject: '', message: '' });
                  }}
                  className="px-4"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.to || !newMessage.subject.trim() || !newMessage.message.trim() || isSending}
                  variant="default"
                  borderRadius="1rem"
                  className="gap-2 px-5"
                >
                  {isSending ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Message History */}
      <Card className="bg-hero-card backdrop-blur-sm border border-[rgba(147,165,197,0.2)] shadow-card rounded-2xl">
        <CardHeader className="p-6">
          <CardTitle className="text-heading-primary text-xl flex items-center gap-3">
            <MessageSquare className="w-5 h-5" />
            Team Messages ({messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-heading-subdued mx-auto mb-3" />
                <p className="text-heading-subdued">No messages yet. Send the first message above.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="bg-light-chip rounded-xl p-5 border border-[rgba(147,165,197,0.2)]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-heading-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-heading-primary">To: {msg.to}</p>
                        <div className="flex items-center gap-2 text-sm text-heading-subdued">
                          <Calendar className="w-3 h-3" />
                          {format(msg.timestamp, 'MMM d, yyyy at h:mm a')}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(msg.status)}`}>
                      {msg.status}
                    </span>
                  </div>
                  <div className="mb-3">
                    <h4 className="font-medium text-heading-primary mb-2">Subject: {msg.subject}</h4>
                  </div>
                  <p className="text-heading-subdued leading-relaxed whitespace-pre-wrap">
                    {msg.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
