import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  User,
  Loader2,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const suggestedPrompts = [
  "Analyze the risk profile of CloudSecure Inc.",
  "What are the common vulnerabilities in our vendor portfolio?",
  "Suggest remediation steps for high-risk vendors",
  "Generate a summary of pending assessments",
];

export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI-powered risk assessment assistant. I can help you analyze vendor risks, interpret questionnaire responses, and provide recommendations for improving your third-party security posture. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        'analyze': "Based on my analysis of CloudSecure Inc., they demonstrate a strong security posture with a risk score of 25 (Low Risk). Key strengths include:\n\n• **Data Encryption**: TLS 1.3 for data in transit and AES-256 for data at rest\n• **Access Controls**: MFA enabled with monthly access reviews\n• **Compliance**: SOC 2 Type II and ISO 27001 certified\n\nRecommendation: Continue annual assessments and consider them for expanded services.",
        'vulnerabilities': "Looking at your vendor portfolio, I've identified the following common vulnerabilities:\n\n1. **Incident Response (32% of vendors)**: Delayed response times exceeding 24 hours\n2. **Access Management (28% of vendors)**: Infrequent privilege reviews\n3. **Encryption Standards (15% of vendors)**: Using outdated TLS versions\n\nI recommend prioritizing remediation efforts on incident response procedures.",
        'remediation': "For high-risk vendors, I recommend the following remediation steps:\n\n1. **Immediate Actions**:\n   - Request updated security documentation\n   - Schedule a call to discuss findings\n   - Set a 30-day improvement deadline\n\n2. **Short-term (30-60 days)**:\n   - Implement additional monitoring\n   - Require evidence of security improvements\n\n3. **Long-term**:\n   - Consider alternative vendors if no improvement\n   - Increase assessment frequency",
        'summary': "Here's a summary of your pending assessments:\n\n📋 **Total Pending**: 23 assessments\n\n**By Status**:\n• In Progress: 12\n• Awaiting Response: 8\n• Under Review: 3\n\n**By Risk Level**:\n• High Priority: 5 (due this week)\n• Medium Priority: 10\n• Low Priority: 8\n\nShall I help prioritize which assessments to review first?",
      };

      let response = "I understand you're asking about vendor risk management. Based on your current portfolio, I can provide detailed analysis on risk scores, compliance gaps, or remediation recommendations. Could you please provide more specific details about what you'd like to explore?";

      if (input.toLowerCase().includes('analyze') || input.toLowerCase().includes('cloudsecure')) {
        response = responses['analyze'];
      } else if (input.toLowerCase().includes('vulnerabilities') || input.toLowerCase().includes('common')) {
        response = responses['vulnerabilities'];
      } else if (input.toLowerCase().includes('remediation') || input.toLowerCase().includes('steps')) {
        response = responses['remediation'];
      } else if (input.toLowerCase().includes('summary') || input.toLowerCase().includes('pending')) {
        response = responses['summary'];
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="p-8 h-screen flex flex-col max-h-screen">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center">
            <Bot className="w-6 h-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
            <p className="text-muted-foreground">
              Get intelligent insights and recommendations for your risk assessments
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Chat Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 flex flex-col"
        >
          <Card className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col p-0 min-h-0">
              <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                <div className="space-y-6">
                  <AnimatePresence>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          message.role === 'assistant'
                            ? 'bg-accent/10 text-accent'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {message.role === 'assistant' ? (
                            <Bot className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                          message.role === 'assistant'
                            ? 'bg-muted'
                            : 'bg-primary text-primary-foreground'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className={`text-xs mt-2 ${
                            message.role === 'assistant' ? 'text-muted-foreground' : 'text-primary-foreground/70'
                          }`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-accent" />
                      </div>
                      <div className="bg-muted rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Analyzing...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-3">
                  <Input
                    placeholder="Ask me about vendor risks, assessments, or recommendations..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-80 space-y-6"
        >
          {/* Suggested Prompts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-warning" />
                Suggested Prompts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setInput(prompt)}
                  className="w-full text-left text-sm p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* AI Capabilities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                AI Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Risk Analysis</p>
                  <p className="text-xs text-muted-foreground">Analyze vendor risk profiles and trends</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Smart Recommendations</p>
                  <p className="text-xs text-muted-foreground">Get actionable remediation steps</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Assessment Summary</p>
                  <p className="text-xs text-muted-foreground">Generate insights from responses</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Threat Detection</p>
                  <p className="text-xs text-muted-foreground">Identify potential vulnerabilities</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
