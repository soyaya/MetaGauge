'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
}

export function SuggestedQuestions({ questions, onQuestionClick }: SuggestedQuestionsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <p className="text-sm font-medium text-muted-foreground mb-3">
        Suggested questions:
      </p>
      <ScrollArea className="w-full max-h-32">
        <div className="space-y-2 pr-4">
          {questions.map((question, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              onClick={() => onQuestionClick(question)}
              className="w-full justify-start text-left h-auto py-2 px-3 text-sm hover:bg-primary/10 transition-colors whitespace-normal"
            >
              {question}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}