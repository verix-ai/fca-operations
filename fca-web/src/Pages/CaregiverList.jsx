
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ClientCaregiver } from "@/entities/ClientCaregiver.supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Eye, Edit, Trash2, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import SectionHeader from "@/components/layout/SectionHeader.jsx";
import { useAuth } from "@/auth/AuthProvider.jsx";
import AddCaregiverModal from "@/components/caregiver/AddCaregiverModal.jsx";

export default function CaregiverList() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [caregivers, setCaregivers] = useState([]);
    const [filteredCaregivers, setFilteredCaregivers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Delete state
    const [deleteId, setDeleteId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadCaregivers = async () => {
        setIsLoading(true);
        try {
            const data = await ClientCaregiver.listAll();
            setCaregivers(data);
        } catch (error) {
            console.error("Error loading caregivers:", error);
        }
        setIsLoading(false);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            await ClientCaregiver.delete(deleteId);
            setCaregivers(prev => prev.filter(c => c.id !== deleteId));
            setDeleteId(null);
        } catch (error) {
            console.error('Error deleting caregiver:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const filterCaregivers = useCallback(() => {
        let filtered = caregivers;

        if (searchTerm) {
            filtered = filtered.filter(c =>
                c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.client?.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter(c => c.status === statusFilter);
        }

        setFilteredCaregivers(filtered);
    }, [caregivers, searchTerm, statusFilter]);

    useEffect(() => {
        loadCaregivers();
    }, []);

    useEffect(() => {
        filterCaregivers();
    }, [filterCaregivers]);

    return (
        <div className="space-y-10">
            <div className="space-y-10">
                {/* Header */}
                <SectionHeader
                    eyebrow="Directory"
                    title="All Caregivers"
                    description="Manage and track all caregivers and their client assignments."
                    actions={
                        <Button
                            variant="default"
                            borderRadius="999px"
                            className="gap-2 px-5"
                            onClick={() => setIsAddModalOpen(true)}
                        >
                            <Plus className="w-4 h-4" />
                            Add Caregiver
                        </Button>
                    }
                />

                {/* Filters */}
                <Card className="border border-[rgba(96,255,168,0.18)] rounded-3xl relative z-10">
                    <CardHeader className="p-6 border-b border-white/5">
                        <CardTitle>
                            <Filter className="w-5 h-5 text-brand/70" />
                            Filters
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brand/80 w-4 h-4" />
                                <Input
                                    placeholder="Search caregivers, clients, or email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="rounded-2xl pl-12 py-3 bg-light-input border border-[rgba(147,165,197,0.25)] text-heading-primary placeholder-white/40 focus:border-brand focus:ring-brand/50"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="rounded-2xl py-3">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Caregiver Table - Desktop */}
                <Card className="hidden md:block border border-[rgba(96,255,168,0.16)] rounded-3xl relative z-0">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b border-white/5">
                                        <TableHead className="text-heading-subdued font-semibold p-6 uppercase tracking-[0.15em] text-xs">Caregiver Name</TableHead>
                                        <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Assigned Client</TableHead>
                                        <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Relationship</TableHead>
                                        <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Status</TableHead>
                                        <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Contact</TableHead>
                                        <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Start Date</TableHead>
                                        <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <TableRow key={i} className="border-b border-white/5">
                                                <TableCell className="text-heading-subdued p-6">Loading...</TableCell>
                                                <TableCell className="text-heading-subdued">-</TableCell>
                                                <TableCell className="text-heading-subdued">-</TableCell>
                                                <TableCell className="text-heading-subdued">-</TableCell>
                                                <TableCell className="text-heading-subdued">-</TableCell>
                                                <TableCell className="text-heading-subdued">-</TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredCaregivers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-heading-subdued py-12">
                                                No caregivers found matching your filters
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredCaregivers.map((bg) => (
                                            <TableRow
                                                key={bg.id}
                                                className="border-b border-white/5 hover:bg-light-chip transition-colors"
                                            >
                                                <TableCell className="font-semibold text-heading-primary p-6">
                                                    {bg.full_name}
                                                </TableCell>
                                                <TableCell className="text-heading-primary/70">
                                                    {bg.status === 'inactive' ? (
                                                        <Badge className="bg-neutral-500/20 text-neutral-300 border-neutral-500/30 px-3 py-1 rounded-lg font-medium">
                                                            Deactivated
                                                        </Badge>
                                                    ) : bg.client?.client_name ? (
                                                        bg.client.client_name
                                                    ) : (
                                                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-3 py-1 rounded-lg font-medium">
                                                            Unassigned
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-kpi-secondary">
                                                    {bg.relationship || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`${bg.status === 'active' ? 'bg-[rgba(99,255,130,0.16)] text-neutral-50 border-brand/45' : 'bg-white/5 text-neutral-400 border-white/10'} px-3 py-1 rounded-lg font-medium`}>
                                                        {bg.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-kpi-secondary">
                                                    <div className="flex flex-col text-xs">
                                                        {bg.phone && <span>{bg.phone}</span>}
                                                        {bg.email && <span>{bg.email}</span>}
                                                        {!bg.phone && !bg.email && '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-kpi-secondary">
                                                    {bg.started_at
                                                        ? format(new Date(bg.started_at), 'MMM d, yyyy')
                                                        : '-'
                                                    }
                                                </TableCell>
                                                <TableCell className="text-heading-primary/70">
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 rounded-full border border-white/10 hover:bg-white/5 hover:border-brand/40 text-neutral-400 hover:text-brand transition-all duration-200"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(createPageUrl('CaregiverDetail', { id: bg.id }));
                                                            }}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 rounded-full border border-white/10 hover:bg-white/5 hover:border-red-500/40 text-neutral-400 hover:text-red-500 transition-all duration-200"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteId(bg.id);
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Caregiver Cards - Mobile */}
                <div className="md:hidden space-y-4">
                    {isLoading ? (
                        Array(3).fill(0).map((_, i) => (
                            <Card key={i} className="border border-[rgba(96,255,168,0.16)] rounded-3xl">
                                <CardContent className="p-4">
                                    <div className="text-heading-subdued">Loading...</div>
                                </CardContent>
                            </Card>
                        ))
                    ) : filteredCaregivers.length === 0 ? (
                        <Card className="border border-[rgba(96,255,168,0.16)] rounded-3xl">
                            <CardContent className="p-6 text-center text-heading-subdued">
                                No caregivers found matching your filters
                            </CardContent>
                        </Card>
                    ) : (
                        filteredCaregivers.map((bg) => (
                            <Card
                                key={bg.id}
                                className="border border-[rgba(96,255,168,0.16)] rounded-3xl hover:border-brand/40 transition-colors"
                            >
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-heading-primary text-lg">
                                                {bg.full_name}
                                            </h3>
                                            <p className="text-sm text-heading-primary/70 mt-1">
                                                Client: {bg.status === 'inactive' ? (
                                                    <Badge className="bg-neutral-500/20 text-neutral-300 border-neutral-500/30 px-2 py-0.5 rounded text-xs font-medium">
                                                        Deactivated
                                                    </Badge>
                                                ) : bg.client?.client_name || (
                                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-2 py-0.5 rounded text-xs font-medium">
                                                        Unassigned
                                                    </Badge>
                                                )}
                                            </p>
                                        </div>
                                        <Badge className={`${bg.status === 'active' ? 'bg-[rgba(99,255,130,0.16)] text-neutral-50 border-brand/45' : 'bg-white/5 text-neutral-400 border-white/10'} px-3 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap`}>
                                            {bg.status}
                                        </Badge>
                                    </div>

                                    <div className="space-y-3 pt-2 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-heading-subdued uppercase tracking-wider min-w-[80px]">Relation</span>
                                            <span className="text-sm text-heading-primary">{bg.relationship || '-'}</span>
                                        </div>
                                        {(bg.phone || bg.email) && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs text-heading-subdued uppercase tracking-wider">Contact</span>
                                                {bg.phone && <span className="text-sm text-heading-primary">{bg.phone}</span>}
                                                {bg.email && <span className="text-sm text-heading-primary">{bg.email}</span>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 pt-3 border-t border-white/5">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 rounded-2xl text-kpi-secondary hover:text-heading-primary hover:bg-light-chip"
                                            onClick={() => navigate(createPageUrl('CaregiverDetail', { id: bg.id }))}
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            View
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 rounded-2xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                                            onClick={() => setDeleteId(bg.id)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Add Caregiver Modal */}
            <AddCaregiverModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => loadCaregivers()}
            />
            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !isDeleting && setDeleteId(null)}
                    />
                    <div className="relative bg-[#0F1115] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4 text-amber-500">
                            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-heading-primary">Delete Caregiver?</h3>
                        </div>

                        <p className="text-heading-subdued mb-6">
                            Are you sure you want to delete this caregiver? This action cannot be undone.
                        </p>

                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                className="rounded-full"
                                onClick={() => setDeleteId(null)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                className="rounded-full"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
