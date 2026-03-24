"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  // Prevent hydration mismatch by returning a blank screen or a spinner 
  // until the component is mounted on the client and redirected.
  if (!mounted) {
    return (
      <div className="flex bg-slate-950 items-center justify-center min-h-screen"></div>
    );
  }

  return (
    <div className="flex bg-slate-950 items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}
