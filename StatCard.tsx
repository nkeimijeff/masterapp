import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  isPositive?: boolean;
  subValue?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  className?: string;
  onClick?: () => void;
}

export function StatCard({ 
  label, 
  value, 
  icon, 
  trend, 
  isPositive, 
  subValue,
  color = 'slate',
  className,
  onClick
}: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
    slate: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
  };

  return (
    <motion.div 
      whileHover={onClick ? { scale: 1.02 } : {}}
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between group h-full",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2.5 rounded-2xl transition-transform group-hover:scale-110", colorClasses[color])}>
          {React.cloneElement(icon as React.ReactElement, { size: 20 })}
        </div>
        {trend && (
          <div className={cn(
            "px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1",
            isPositive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
          )}>
            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend}
          </div>
        )}
      </div>
      
      <div>
        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 mb-1 tracking-widest leading-none">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-xl font-black font-mono dark:text-white tracking-tighter leading-none">
            {value}
          </h3>
          {subValue && (
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 truncate">
              {subValue}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
