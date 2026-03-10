"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { ShieldAlert } from "lucide-react";

const WalletConnector = dynamic(
    () => import("./WalletConnector").then((mod) => mod.WalletConnector),
    { ssr: false }
);

export function Navbar() {
    const pathname = usePathname();

    const links = [
        { href: "/", label: "Home" },
        { href: "/generate", label: "Generate Proof" },
        { href: "/deposit", label: "Deposit" },
        { href: "/dashboard", label: "Compliance Dashboard" },
    ];

    return (
        <nav className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">

                    {/* Logo & Links */}
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="bg-indigo-500/20 p-2 rounded-xl group-hover:bg-indigo-500/30 transition-colors">
                                <ShieldAlert className="w-6 h-6 text-indigo-400" />
                            </div>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                                Gatekeeper
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-1">
                            {links.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                            ? "bg-zinc-800/50 text-white"
                                            : "text-zinc-400 hover:text-white hover:bg-zinc-800/30"
                                            }`}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-4">
                        <span className="hidden sm:inline-block text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 rounded-full px-3 py-1">
                            Sepolia
                        </span>
                        <WalletConnector />
                    </div>

                </div>
            </div>
        </nav>
    );
}
