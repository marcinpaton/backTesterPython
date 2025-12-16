"""
Progress tracking for optimization
"""
from threading import Lock

class ProgressTracker:
    def __init__(self):
        self.lock = Lock()
        self.current = 0
        self.total = 0
        self.window_current = None
        self.window_total = None
        self.is_running = False
        
    def start(self, total, window_total=None):
        with self.lock:
            self.current = 0
            self.total = total
            self.window_current = 1 if window_total else None
            self.window_total = window_total
            self.is_running = True
    
    def update(self, current, window_current=None):
        with self.lock:
            self.current = current
            if window_current is not None:
                self.window_current = window_current
    
    def finish(self):
        with self.lock:
            self.is_running = False
            self.current = self.total
    
    def get_status(self):
        with self.lock:
            return {
                'is_running': self.is_running,
                'current': self.current,
                'total': self.total,
                'window_current': self.window_current,
                'window_total': self.window_total,
                'percentage': (self.current / self.total * 100) if self.total > 0 else 0
            }

# Global instance
progress_tracker = ProgressTracker()
