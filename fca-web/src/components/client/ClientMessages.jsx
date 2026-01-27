import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, User, Calendar, UserCircle, Heart } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import UserEntity from "@/entities/User.supabase";
import MessageEntity from "@/entities/Message.supabase";
import NotificationEntity from "@/entities/Notification.supabase";

export default function ClientMessages({ clientId, clientName }) {
  const [messages, setMessages] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [newMessage, setNewMessage] = useState({
    recipientId: '',
    recipientName: '',
    subject: '',
    message: ''
  });
  const [isComposing, setIsComposing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Fetch messages for this client
  useEffect(() => {
    if (!clientId) return;
    
    (async () => {
      try {
        setIsLoading(true);
        const data = await MessageEntity.listByClient(clientId);
        setMessages(data);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [clientId]);

  // Fetch team members from database
  useEffect(() => {
    (async () => {
      try {
        const users = await UserEntity.list();
        const formatted = users
          .filter(u => u.is_active !== false)
          .map(u => ({
            id: u.id,
            label: u.name || u.email
          }));
        setTeamMembers(formatted);
      } catch (err) {
        console.error('Error fetching team members:', err);
      }
    })();
  }, []);

  const handleSendMessage = async () => {
    if (newMessage.recipientId && newMessage.subject.trim() && newMessage.message.trim() && clientId) {
      setIsSending(true);
      
      try {
        // Send the message
        const sent = await MessageEntity.send({
          recipient_id: newMessage.recipientId,
          subject: newMessage.subject.trim(),
          content: newMessage.message.trim(),
          client_id: clientId
        });
        
        // Create a notification for the recipient
        try {
          await NotificationEntity.create({
            user_id: newMessage.recipientId,
            type: 'message_received',
            title: 'New Message',
            message: `You have a new message about client ${clientName || 'a client'}: "${newMessage.subject.trim()}"`,
            related_entity_type: 'message',
            related_entity_id: sent.id
          });
        } catch (notifErr) {
          // Notification creation may fail, but message was sent successfully
          console.warn('Could not create notification:', notifErr?.message);
        }
        
        setMessages([sent, ...messages]);
        setNewMessage({ recipientId: '', recipientName: '', subject: '', message: '' });
        setIsComposing(false);
      } catch (err) {
        console.error('Error sending message:', err);
        console.error('Error details:', err?.message, err?.code, err?.details);
        alert(`Failed to send message: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsSending(false);
      }
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
                  <Select 
                    value={newMessage.recipientId} 
                    onValueChange={(value) => {
                      const member = teamMembers.find(m => m.id === value);
                      setNewMessage({...newMessage, recipientId: value, recipientName: member?.label || ''});
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.label}
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
                    setNewMessage({ recipientId: '', recipientName: '', subject: '', message: '' });
                  }}
                  className="px-4"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.recipientId || !newMessage.subject.trim() || !newMessage.message.trim() || isSending}
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
            {isLoading ? (
              <div className="text-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand mx-auto mb-3" />
                <p className="text-heading-subdued">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-heading-subdued mx-auto mb-3" />
                <p className="text-heading-subdued">No messages yet. Send the first message above.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const activeCaregiver = msg.client?.caregivers?.find(c => c.status === 'active');
                return (
                  <div key={msg.id} className="bg-light-chip rounded-xl p-5 border border-[rgba(147,165,197,0.2)]">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-heading-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-heading-primary">
                            From: {msg.sender?.name || msg.sender?.email || 'Unknown'} → To: {msg.recipient?.name || msg.recipient?.email || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-heading-subdued">
                            <Calendar className="w-3 h-3" />
                            {msg.created_at ? format(new Date(msg.created_at), "MMM d, yyyy 'at' h:mm a") : 'Unknown date'}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(msg.is_read ? 'read' : 'sent')}`}>
                        {msg.is_read ? 'read' : 'sent'}
                      </span>
                    </div>
                    
                    {/* Client and Caregiver Tags */}
                    {msg.client && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Link to={`/client/${msg.client.id}`}>
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 cursor-pointer gap-1">
                            <UserCircle className="w-3 h-3" />
                            Client: {msg.client.client_name}
                          </Badge>
                        </Link>
                        {activeCaregiver && (
                          <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 gap-1">
                            <Heart className="w-3 h-3" />
                            Caregiver: {activeCaregiver.full_name}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="mb-3">
                      <h4 className="font-medium text-heading-primary mb-2">Subject: {msg.subject}</h4>
                    </div>
                    <p className="text-heading-subdued leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
