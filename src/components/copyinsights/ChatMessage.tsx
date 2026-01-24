import { cn } from '@/lib/utils';
import { Bot, User, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DOMPurify from 'dompurify';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = role === 'user';

  // Enhanced markdown formatting
  const formatContent = (text: string) => {
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeContent = part.slice(3, -3);
        const firstNewline = codeContent.indexOf('\n');
        const language = firstNewline > 0 ? codeContent.slice(0, firstNewline).trim() : '';
        const code = firstNewline > 0 ? codeContent.slice(firstNewline + 1) : codeContent;
        return (
          <pre key={i} className="bg-muted/50 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono">
            {language && <div className="text-muted-foreground text-[10px] mb-1">{language}</div>}
            <code>{code}</code>
          </pre>
        );
      }

      // Process inline formatting
      return (
        <span key={i}>
          {part.split('\n').map((line, j) => {
            // Tables
            if (line.includes('|') && line.trim().startsWith('|')) {
              return renderTableRow(line, j);
            }

            // Headers
            if (line.startsWith('### ')) {
              return <h4 key={j} className="font-semibold text-sm mt-3 mb-1">{formatInline(line.slice(4))}</h4>;
            }
            if (line.startsWith('## ')) {
              return <h3 key={j} className="font-semibold text-base mt-3 mb-1">{formatInline(line.slice(3))}</h3>;
            }
            if (line.startsWith('# ')) {
              return <h2 key={j} className="font-bold text-lg mt-3 mb-1">{formatInline(line.slice(2))}</h2>;
            }
            
            // Bullet points
            if (line.startsWith('- ') || line.startsWith('* ')) {
              return (
                <div key={j} className="flex gap-2 my-0.5 pl-1">
                  <span className="text-muted-foreground">•</span>
                  <span className="flex-1">{formatInline(line.slice(2))}</span>
                </div>
              );
            }
            
            // Numbered lists
            const numMatch = line.match(/^(\d+)\.\s/);
            if (numMatch) {
              return (
                <div key={j} className="flex gap-2 my-0.5 pl-1">
                  <span className="text-muted-foreground min-w-[1.5rem]">{numMatch[1]}.</span>
                  <span className="flex-1">{formatInline(line.slice(numMatch[0].length))}</span>
                </div>
              );
            }

            // Blockquotes
            if (line.startsWith('> ')) {
              return (
                <blockquote key={j} className="border-l-2 border-primary/50 pl-3 my-2 text-muted-foreground italic">
                  {formatInline(line.slice(2))}
                </blockquote>
              );
            }

            // Horizontal rule
            if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
              return <hr key={j} className="my-3 border-border" />;
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

  const renderTableRow = (line: string, key: number) => {
    const cells = line.split('|').filter(cell => cell.trim());
    const isHeader = line.includes('---');
    
    if (isHeader) {
      return null; // Skip separator rows
    }

    return (
      <div key={key} className="flex gap-2 text-xs py-1 border-b border-border/50 last:border-b-0">
        {cells.map((cell, i) => (
          <span 
            key={i} 
            className={cn(
              "flex-1 truncate",
              i === 0 && "font-medium"
            )}
          >
            {formatInline(cell.trim())}
          </span>
        ))}
      </div>
    );
  };

  const formatInline = (text: string) => {
    // Process inline formatting with regex replacements
    let processed = text;
    
    // Bold
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Italic
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code
    processed = processed.replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');

    // Trend indicators with colors
    processed = processed.replace(/↑\s*\+?([\d.]+%?)/g, '<span class="text-green-600 dark:text-green-400 font-medium">↑ +$1</span>');
    processed = processed.replace(/↓\s*-?([\d.]+%?)/g, '<span class="text-red-600 dark:text-red-400 font-medium">↓ -$1</span>');
    
    // Checkmarks and X marks
    processed = processed.replace(/✓/g, '<span class="text-green-600 dark:text-green-400">✓</span>');
    processed = processed.replace(/✗/g, '<span class="text-red-600 dark:text-red-400">✗</span>');
    
    // Sanitize HTML to prevent XSS attacks
    const sanitized = DOMPurify.sanitize(processed, {
      ALLOWED_TAGS: ['strong', 'em', 'code', 'span'],
      ALLOWED_ATTR: ['class'],
    });
    
    return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
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
          <div className="flex items-center gap-1 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
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
            <div className="flex items-center gap-0.5 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  feedback === 'up' && "text-green-600 bg-green-100 dark:bg-green-900/30"
                )}
                onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              >
                <ThumbsUp className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  feedback === 'down' && "text-red-600 bg-red-100 dark:bg-red-900/30"
                )}
                onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              >
                <ThumbsDown className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
