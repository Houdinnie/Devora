import { Response } from 'express';

export interface SSEMessage {
  type: 'agent' | 'workflow' | 'error' | 'progress' | 'complete';
  agent?: string;
  step?: string;
  status: 'starting' | 'running' | 'completed' | 'failed';
  data?: unknown;
  output?: string;
  error?: string;
}

export class SSEStream {
  private response: Response;
  private closed = false;

  constructor(response: Response) {
    this.response = response;
    this.sendHeader();
  }

  private sendHeader(): void {
    this.response.setHeader('Content-Type', 'text/event-stream');
    this.response.setHeader('Cache-Control', 'no-cache');
    this.response.setHeader('Connection', 'keep-alive');
    this.response.setHeader('X-Accel-Buffering', 'no');
  }

  send(message: SSEMessage): void {
    if (this.closed) return;
    
    const data = `data: ${JSON.stringify(message)}\n\n`;
    this.response.write(data);
  }

  sendEvent(event: string, data: unknown): void {
    if (this.closed) return;
    
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.response.write(message);
  }

  agentStart(agentId: string, step?: string): void {
    this.send({
      type: 'agent',
      agent: agentId,
      step,
      status: 'starting',
    });
  }

  agentRunning(agentId: string, step?: string, data?: unknown): void {
    this.send({
      type: 'agent',
      agent: agentId,
      step,
      status: 'running',
      data,
    });
  }

  agentComplete(agentId: string, output: string): void {
    this.send({
      type: 'agent',
      agent: agentId,
      status: 'completed',
      output,
    });
  }

  agentFailed(agentId: string, error: string): void {
    this.send({
      type: 'agent',
      agent: agentId,
      status: 'failed',
      error,
    });
  }

  workflowProgress(current: number, total: number, message?: string): void {
    this.send({
      type: 'progress',
      status: 'running',
      data: { current, total, message },
    });
  }

  workflowComplete(outputs: Record<string, string>): void {
    this.send({
      type: 'complete',
      status: 'completed',
      output: JSON.stringify(outputs),
    });
  }

  workflowFailed(error: string): void {
    this.send({
      type: 'error',
      status: 'failed',
      error,
    });
  }

  error(message: string, details?: unknown): void {
    this.send({
      type: 'error',
      status: 'failed',
      error: message,
      data: details,
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    
    if (!this.response.writableEnded) {
      this.response.end();
    }
  }

  ping(): void {
    if (!this.closed) {
      this.response.write(': ping\n\n');
    }
  }
}

export function createSSEStream(response: Response): SSEStream {
  return new SSEStream(response);
}

export function setSSEHeaders(response: Response): void {
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
}