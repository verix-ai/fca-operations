import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Save, Calendar, User } from "lucide-react";
import { format } from "date-fns";

export default function ClientNotes({ clientId }) {
  const [notes, setNotes] = useState([
    {
      id: 1,
      content: "Initial assessment completed. Client shows good engagement and understanding of the program requirements.",
      author: "Sarah Johnson",
      timestamp: new Date("2024-01-20T10:30:00"),
      type: "assessment"
    },
    {
      id: 2,
      content: "Caregiver training scheduled for next week. Need to follow up on background check completion.",
      author: "Michael Davis",
      timestamp: new Date("2024-01-22T14:15:00"),
      type: "follow-up"
    }
  ]);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const handleAddNote = () => {
    if (newNote.trim()) {
      const note = {
        id: Date.now(),
        content: newNote.trim(),
        author: "Current User", // This would come from the authenticated user
        timestamp: new Date(),
        type: "general"
      };
      setNotes([note, ...notes]);
      setNewNote('');
      setIsAddingNote(false);
    }
  };

  const getNoteTypeColor = (type) => {
    switch (type) {
      case 'assessment':
        return 'bg-brand/10 text-heading-primary';
      case 'follow-up':
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
            {notes.length === 0 ? (
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
                        <p className="font-medium text-heading-primary">{note.author}</p>
                        <div className="flex items-center gap-2 text-sm text-heading-subdued">
                          <Calendar className="w-3 h-3" />
                          {format(note.timestamp, 'MMM d, yyyy at h:mm a')}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getNoteTypeColor(note.type)}`}>
                      {note.type}
                    </span>
                  </div>
                  <p className="text-heading-subdued leading-relaxed whitespace-pre-wrap">
                    {note.content}
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
