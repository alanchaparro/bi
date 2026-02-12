import pandas as pd
import mysql.connector
import os

from db_config import get_db_config

def export_to_csv():
    db_config = get_db_config()

    # Output file name
    output_file = 'cartera.csv'
    query_file = 'query.sql'

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
        # Use chunking to avoid memory issues
        chunk_size = 5000
        reader = pd.read_sql(query, conn, chunksize=chunk_size)
        
        total_rows = 0
        first_chunk = True
        
        for chunk in reader:
            # Field Calculation: tramo
            # cuotas_vencidas >= 7 -> 7, else value
            chunk['tramo'] = chunk['cuotas_vencidas'].apply(lambda x: 7 if x >= 7 else x)
            
            # Field Calculation: Categoría Tramo
            # 0, 1, 2, 3 -> Vigentes, 4+ -> Morosos
            chunk['categoria_tramo'] = chunk['tramo'].apply(lambda x: 'Vigentes' if x <= 3 else 'Morosos')
            
            # Field Calculation: Fecha gestion
            # fecha_cierre is formatted as %Y/%m/%d in SQL. Convert to datetime first.
            chunk['fecha_cierre_dt'] = pd.to_datetime(chunk['fecha_cierre'], format='%Y/%m/%d')
            # Add one month to the date. We can use offsets.
            chunk['Fecha gestion'] = (chunk['fecha_cierre_dt'] + pd.DateOffset(months=1)).dt.strftime('%m/%Y')
            
            # Remove temporary datetime column
            chunk = chunk.drop(columns=['fecha_cierre_dt'])

            total_rows += len(chunk)
            print(f"Writing chunk... Total rows so far: {total_rows}")
            # Write to CSV
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
    export_to_csv()
