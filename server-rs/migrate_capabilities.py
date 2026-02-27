import sqlite3
import json
import re

def to_snake_case(s):
    # Just lowercase and replace spaces with underscores, since that matches the current broken ones
    # like "Code Review" -> "code_review"
    s = s.strip()
    return s.lower().replace(" ", "_").replace("-", "_")

def main():
    db_path = "../tadpole.db"
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, skills, workflows FROM agents")
    rows = cursor.fetchall()
    
    updated_count = 0
    for row in rows:
        agent_id, name, skills_json, workflows_json = row
        
        try:
            skills = json.loads(skills_json) if skills_json else []
            workflows = json.loads(workflows_json) if workflows_json else []
        except:
            continue
            
        new_skills = [to_snake_case(s) for s in skills]
        new_workflows = [to_snake_case(w) for w in workflows]
        
        # Only update if there are changes to avoid unnecessary writes
        if skills != new_skills or workflows != new_workflows:
            print(f"Updating Agent '{name}' (ID: {agent_id})")
            print(f"  Skills: {skills} -> {new_skills}")
            print(f"  Workflows: {workflows} -> {new_workflows}")
            
            cursor.execute(
                "UPDATE agents SET skills = ?, workflows = ? WHERE id = ?",
                (json.dumps(new_skills), json.dumps(new_workflows), agent_id)
            )
            updated_count += 1

    conn.commit()
    conn.close()
    print(f"Done. Updated {updated_count} agents.")

if __name__ == '__main__':
    main()
