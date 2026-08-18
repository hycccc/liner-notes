
interface AnimatedGradientProps {
  isDark: boolean;
}

export const AnimatedGradient = ({ isDark }: AnimatedGradientProps) => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className={`absolute -top-[30%] -left-[15%] w-[600px] h-[600px] rounded-full blur-[160px] animate-blob ${isDark ? 'bg-purple-600 opacity-10' : 'bg-purple-400 opacity-15'}`} />
      <div className={`absolute top-[20%] -right-[15%] w-[500px] h-[500px] rounded-full blur-[140px] animate-blob animation-delay-2000 ${isDark ? 'bg-rose-500 opacity-15' : 'bg-amber-300 opacity-25'}`} />
      <div className={`absolute -bottom-[30%] left-[20%] w-[550px] h-[550px] rounded-full blur-[160px] animate-blob animation-delay-4000 ${isDark ? 'bg-blue-600 opacity-15' : 'bg-cyan-300 opacity-20'}`} />
      <div className={`absolute top-[55%] left-[5%] w-[300px] h-[300px] rounded-full blur-[120px] animate-blob animation-delay-2000 ${isDark ? 'bg-emerald-600 opacity-8' : 'bg-emerald-300 opacity-10'}`} />
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};
