import os
import re
import fitz
import logging

logger = logging.getLogger(__name__)

class SystemFontManager:
    def __init__(self):
        self.font_map = {}
        self.initialized = False

    def initialize(self):
        if self.initialized:
            return
            
        system_font_dirs = [
            "C:\\Windows\\Fonts",
            os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'Windows', 'Fonts'),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "fonts")
        ]
        
        fonts_scanned = 0
        for font_dir in system_font_dirs:
            if not os.path.exists(font_dir):
                logger.warning(f"Font directory not found: {font_dir}")
                continue
                
            fonts = [f for f in os.listdir(font_dir) if f.lower().endswith(".ttf")]
            for f in fonts:
                fonts_scanned += 1
                path = os.path.join(font_dir, f)
                try:
                    font = fitz.Font(fontfile=path)
                    name = font.name
                    
                    def norm(s): return re.sub(r'[^a-zA-Z0-9]', '', s).lower()
                    norm_name = norm(name)
                    
                    # Also index the filename without extension as a fallback
                    norm_file = norm(f.replace(".ttf", ""))
                    
                    if norm_name not in self.font_map:
                        self.font_map[norm_name] = path
                    if norm_file not in self.font_map:
                        self.font_map[norm_file] = path
                        
                except Exception:
                    pass
                
        self.initialized = True
        logger.info(f"Indexed {len(self.font_map)} system font aliases.")

    def get_font_file(self, pdf_font_name: str) -> str:
        if not self.initialized:
            self.initialize()
            
        def norm(s): return re.sub(r'[^a-zA-Z0-9]', '', s).lower()
        norm_req = norm(pdf_font_name)
        
        # Manual overrides for LaTeX fonts if they don't have exact match
        if norm_req not in self.font_map:
            if norm_req.startswith("cmbx") and "cmb10" in self.font_map: norm_req = "cmb10"
            elif norm_req.startswith("cmr") and "cmr10" in self.font_map: norm_req = "cmr10"
            
        if norm_req in self.font_map:
            return self.font_map[norm_req]
            
        clean_req = norm_req.replace("psmt", "").replace("mt", "").replace("regular", "")
        if clean_req in self.font_map:
            return self.font_map[clean_req]
            
        best_match = None
        best_len = 0
        
        def strip_digits(s): return re.sub(r'\d+', '', s)
        clean_req_nodigits = strip_digits(clean_req)
        
        for k, v in self.font_map.items():
            clean_k = strip_digits(k)
            if k in clean_req or clean_req in k or (clean_req_nodigits and (clean_k in clean_req_nodigits or clean_req_nodigits in clean_k)):
                if len(k) > best_len:
                    best_len = len(k)
                    best_match = v
                    
        return best_match

font_manager = SystemFontManager()
