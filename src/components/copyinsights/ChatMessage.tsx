import { cn } from '@/lib/utils';
import { Bot, User, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = role === 'user';

  // Simple markdown-like formatting
  const formatContent = (text: string) => {
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, '');
        return (
          <pre key={i} className="bg-muted/50 rounded-md p-3 my-2 overflow-x-auto text-sm">
            <code>{code}</code>
          </pre>
        );
      }

      // Process inline formatting
      return (
        <span key={i}>
          {part.split('\n').map((line, j) => {
            // Headers
            if (line.startsWith('### ')) {
              return <h4 key={j} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>;
            }
            if (line.startsWith('## ')) {
              return <h3 key={j} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>;
            }
            if (line.startsWith('# ')) {
              return <h2 key={j} className="font-bold text-lg mt-3 mb-1">{line.slice(2)}</h2>;
            }
            
            // Bullet points
            if (line.startsWith('- ') || line.startsWith('* ')) {
              return (
                <div key={j} className="flex gap-2 my-0.5">
                  <span className="text-muted-foreground">•</span>
                  <span>{formatInline(line.slice(2))}</span>
                </div>
              );
            }
            
            // Numbered lists
            const numMatch = line.match(/^(\d+)\.\s/);
            if (numMatch) {
              return (
                <div key={j} className="flex gap-2 my-0.5">
                  <span className="text-muted-foreground min-w-[1.5rem]">{numMatch[1]}.</span>
                  <span>{formatInline(line.slice(numMatch[0].length))}</span>
                </div>
              );
            }
            
            // Regular text
            if (line.trim()) {
              return <p key={j} className="my-1">{formatInline(line)}</p>;
            }
            
            return <br key={j} />;
          })}
        </span>
      );
    });
  };

  const formatInline = (text: string) => {
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    text = text.replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');
    
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  return (
    <div className={cn(
      'flex gap-3 p-3 rounded-lg',
      isUser ? 'bg-primary/10' : 'bg-muted/30'
    )}>
      <div className={cn(
        'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm leading-relaxed">
          {formatContent(content)}
        </div>
        
        {!isUser && content && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
