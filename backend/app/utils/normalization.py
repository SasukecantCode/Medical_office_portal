import re

def normalize_staff_name(name: str) -> str:
    if not name:
        return name
        
    name = name.strip()
    
    # Map of regex patterns to their normalized prefixes.
    # Ordered to prioritize longer overlapping prefixes first (e.g., 'mrs' before 'mr').
    prefixes_map = {
        r'^dr[\s.]+': 'Dr. ',
        r'^shri[\s.]+': 'Shri. ',
        r'^smti[\s.]+': 'Smti. ',
        r'^smt[\s.]+': 'Smt. ',
        r'^miss[\s.]+': 'Miss. ',
        r'^mrs[\s.]+': 'Mrs. ',
        r'^ms[\s.]+': 'Ms. ',
        r'^mr[\s.]+': 'Mr. ',
        r'^chow[\s.]+': 'Chow ',
        r'^chou[\s.]+': 'Chou ',
        r'^nang[\s.]+': 'Nang '
    }
    
    # Normalize multiple spaces
    name = re.sub(r'\s+', ' ', name)
    
    found_prefix = None
    for pattern, correct_prefix in prefixes_map.items():
        if re.search(pattern, name, re.IGNORECASE):
            # Strip the prefix from the beginning
            name = re.sub(pattern, '', name, flags=re.IGNORECASE).strip()
            found_prefix = correct_prefix
            break
            
    # Convert to title case
    # title() works well for standard names, converting 'PADI TALA' to 'Padi Tala'
    name = name.title()
    # Remove any prefix EXCEPT 'Dr. ' if the name contains 'Chou', 'Chow', or 'Nang'
    # as they are standalone honorifics
    if found_prefix and found_prefix != 'Dr. ':
        if (name.startswith('Chou ') or name == 'Chou' or 
            name.startswith('Chow ') or name == 'Chow' or 
            name.startswith('Nang ') or name == 'Nang'):
            found_prefix = None
    
    if found_prefix:
        name = found_prefix + name
        
    return name
