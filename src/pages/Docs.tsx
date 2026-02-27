/**
 * @page Docs
 * Knowledge Base interface.
 * Features full-text search indexing across markdown files with
 * relevance-weighted ranking and categorized navigation.
 */
import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, ChevronRight, ChevronDown, FileText, Book } from 'lucide-react';
import clsx from 'clsx';

// Load all markdown files from knowledge base
const modules = import.meta.glob('../data/knowledge/**/*.md', { query: '?raw', import: 'default', eager: true });

type DocPage = {
    path: string;
    category: string;
    name: string;
    title: string;
    content: string;
};

// Utility to parse frontmatter and content
const parseDoc = (path: string, rawContent: string): DocPage => {
    const parts = path.split('/');
    const category = parts[parts.length - 2];
    const filename = parts[parts.length - 1];

    // Simple frontmatter parser
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = rawContent.match(frontmatterRegex);

    let content = rawContent;
    let title = filename.replace('.md', '').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

    if (match) {
        content = match[2];
        const yaml = match[1];
        const nameMatch = yaml.match(/name:\s*(.+)/);
        if (nameMatch) title = nameMatch[1];
    }

    return {
        path,
        category: category.charAt(0).toUpperCase() + category.slice(1),
        name: filename,
        title,
        content
    };
};

export default function Docs() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDoc, setSelectedDoc] = useState<DocPage | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        'Engineering': true,
        'Product': true,
        'Executive': true
    });

    const docs = useMemo(() => {
        return Object.entries(modules as Record<string, string>).map(([path, content]) => parseDoc(path, content));
    }, []);

    // Group docs by category
    const groupedDocs = useMemo(() => {
        const groups: Record<string, DocPage[]> = {};
        docs.forEach(doc => {
            if (!groups[doc.category]) groups[doc.category] = [];
            groups[doc.category].push(doc);
        });
        return groups;
    }, [docs]);

    // Set initial doc
    useEffect(() => {
        if (!selectedDoc && docs.length > 0) {
            // Prefer System Architecture if available
            const defaultDoc = docs.find(d => d.name.includes('system-architecture')) || docs[0];
            setSelectedDoc(defaultDoc);
        }
    }, [docs]);

    const filteredDocs = useMemo(() => {
        if (!searchTerm) return groupedDocs;
        const keywords = searchTerm.toLowerCase().split(/\s+/).filter(k => k.length > 1);
        const filtered: Record<string, DocPage[]> = {};

        Object.entries(groupedDocs).forEach(([category, pages]) => {
            const matchingPages = pages
                .map(p => {
                    const lowerTitle = p.title.toLowerCase();
                    const lowerContent = p.content.toLowerCase();

                    // Simple relevance score based on keyword hits
                    let score = 0;
                    keywords.forEach(k => {
                        if (lowerTitle.includes(k)) score += 10;
                        const contentHits = lowerContent.split(k).length - 1;
                        score += contentHits;
                    });

                    return { ...p, score };
                })
                .filter(p => p.score > 0)
                .sort((a, b) => b.score - a.score);

            if (matchingPages.length > 0) filtered[category] = matchingPages;
        });
        return filtered;
    }, [groupedDocs, searchTerm]);

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
    };

    return (
        <div className="max-w-7xl mx-auto flex gap-6 h-full font-sans antialiased">
            {/* Docs Sidebar */}
            <div className="w-64 hidden lg:block sticky top-0 self-start space-y-6 shrink-0 flex flex-col h-full overflow-hidden">
                <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                    <input
                        type="text"
                        placeholder="Search docs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
                    />
                </div>

                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                    {Object.entries(filteredDocs).map(([category, pages]) => (
                        <div key={category} className="space-y-1">
                            <div
                                onClick={() => toggleCategory(category)}
                                className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-2 cursor-pointer hover:text-zinc-300"
                            >
                                {category}
                                {expandedCategories[category] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </div>

                            {expandedCategories[category] && (
                                <div className="space-y-0.5">
                                    {pages.map(doc => (
                                        <div
                                            key={doc.path}
                                            onClick={() => setSelectedDoc(doc)}
                                            className={clsx(
                                                "px-2 py-1.5 rounded text-xs cursor-pointer transition-colors flex items-center gap-2",
                                                selectedDoc?.path === doc.path
                                                    ? "bg-zinc-800 text-zinc-200 font-medium border-l-2 border-blue-500"
                                                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                                            )}
                                        >
                                            <FileText size={12} className={selectedDoc?.path === doc.path ? "text-blue-400" : "opacity-50"} />
                                            {doc.title}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Docs Content */}
            <div className="flex-1 bg-zinc-900 px-10 py-8 rounded-xl border border-zinc-800 shadow-sm min-h-0 overflow-y-auto custom-scrollbar">
                {selectedDoc ? (
                    <article className="prose prose-invert prose-zinc max-w-none prose-headings:text-zinc-100 prose-headings:font-semibold prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-code:text-pink-300 prose-code:bg-zinc-950 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:border prose-code:border-zinc-800 prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-xl">
                        <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
                    </article>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
                        <Book size={48} className="opacity-20" />
                        <p>Select a document to view</p>
                    </div>
                )}
            </div>
        </div>
    );
}
