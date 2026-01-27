import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Save, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import ClientNotesEntity from "@/entities/ClientNotes.supabase";

export default function ClientNotes({ clientId }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notes from database
  useEffect(() => {
    if (!clientId) return;
    
    (async () => {
      try {
        setIsLoading(true);
        const data = await ClientNotesEntity.list(clientId);
        setNotes(data);
      } catch (err) {
        console.error('Error fetching notes:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [clientId]);

  const handleAddNote = async () => {
    if (newNote.trim() && clientId) {
      try {
        const created = await ClientNotesEntity.create(clientId, {
          note: newNote.trim(),
          is_important: false
        });
        setNotes([created, ...notes]);
        setNewNote('');
        setIsAddingNote(false);
      } catch (err) {
        console.error('Error creating note:', err);
      }
    }
  };

  const getNoteTypeColor = (type) => {
    switch (type) {
      case 'important':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-light-chip text-heading-subdued';
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Note */}
      <Card className="bg-hero-card backdrop-blur-sm border border-[rgba(147,165,197,0.2)] shadow-card rounded-2xl">
        <CardHeader className="p-6">
          <CardTitle className="text-heading-primary text-xl flex items-center justify-between">
            <span className="flex items-center gap-3">
              <Plus className="w-5 h-5" />
              Add New Note
            </span>
            {!isAddingNote && (
              <Button
                onClick={() => setIsAddingNote(true)}
                variant="default"
                size="sm"
                borderRadius="999px"
                className="gap-2 px-5"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Note
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        {isAddingNote && (
          <CardContent className="p-6 pt-0">
            <div className="space-y-4">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this client..."
                className="rounded-xl py-3 h-32"
              />
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  borderRadius="1rem"
                  onClick={() => {
                    setIsAddingNote(false);
                    setNewNote('');
                  }}
                  className="px-4"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  variant="default"
                  borderRadius="1rem"
                  className="gap-2 px-5"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Note
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Existing Notes */}
      <Card className="bg-hero-card backdrop-blur-sm border border-[rgba(147,165,197,0.2)] shadow-card rounded-2xl">
        <CardHeader className="p-6">
          <CardTitle className="text-heading-primary text-xl flex items-center gap-3">
            <FileText className="w-5 h-5" />
            Client Notes ({notes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand mx-auto mb-3" />
                <p className="text-heading-subdued">Loading notes...</p>
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-heading-subdued mx-auto mb-3" />
                <p className="text-heading-subdued">No notes yet. Add the first note above.</p>
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="bg-light-chip rounded-xl p-5 border border-[rgba(147,165,197,0.2)]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-heading-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-heading-primary">{note.user?.name || note.user?.email || 'Unknown'}</p>
                        <div className="flex items-center gap-2 text-sm text-heading-subdued">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(note.created_at), 'MMM d, yyyy at h:mm a')}
                        </div>
                      </div>
                    </div>
                    {note.is_important && (
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getNoteTypeColor('important')}`}>
                        important
                      </span>
                    )}
                  </div>
                  <p className="text-heading-subdued leading-relaxed whitespace-pre-wrap">
                    {note.note}
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
