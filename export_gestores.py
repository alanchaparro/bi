import pandas as pd
import mysql.connector
import os

from db_config import get_db_config

def export_gestores():
    db_config = get_db_config()

    # Output file name
    output_file = 'gestores.csv'
    query_file = 'query_gestores.sql'

    if not os.path.exists(query_file):
        print(f"Error: {query_file} not found.")
        return

    print(f"Reading query from {query_file}...")
    with open(query_file, 'r', encoding='utf-8') as f:
        query = f.read()

    try:
        print("Connecting to database...")
        conn = mysql.connector.connect(**db_config)
        
        print("Executing query...")
        chunk_size = 5000
        reader = pd.read_sql(query, conn, chunksize=chunk_size)
        
        total_rows = 0
        first_chunk = True
        
        for chunk in reader:
            total_rows += len(chunk)
            print(f"Writing chunk... Total rows so far: {total_rows}")
            chunk.to_csv(output_file, index=False, mode='a' if not first_chunk else 'w', header=first_chunk)
            first_chunk = False

        if total_rows > 0:
            print(f"Export successful! {total_rows} rows saved to {output_file}.")
        else:
            print("No data found for the given query.")
            if os.path.exists(output_file):
                os.remove(output_file)
        
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            conn.close()

if __name__ == "__main__":
    export_gestores()
