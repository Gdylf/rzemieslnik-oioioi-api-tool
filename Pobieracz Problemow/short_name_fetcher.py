import os
import json
from bs4 import BeautifulSoup
from typing import List, Dict, Any

# -----------------------------------------------------
# KONFIGURACJA
# -----------------------------------------------------
PLIK_WEJSCIOWY = "wyzwania.html"
PLIK_WYJSCIOWY = "problemy.json"
def pobierz_problemy(plik_html: str) -> List[Dict[str, str]]:
    """
    Parsuje plik HTML, wyodrębnia short name i pełną nazwę każdego zadania.
    Zwraca listę słowników z tymi danymi.
    """
    print(f"1. Wczytywanie pliku: {plik_html}...")
    
    if not os.path.exists(plik_html):
        print(f"❌ Błąd: Nie znaleziono pliku '{plik_html}'. Upewnij się, że został wcześniej utworzony.")
        return []

    try:
        with open(plik_html, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except Exception as e:
        print(f"❌ Błąd odczytu pliku: {e}")
        return []

    soup = BeautifulSoup(html_content, 'html.parser')
    problem_list = []

    # Szukamy głównej tabeli z zadaniami (klasa 'table--narrow')
    problems_table = soup.find('table', class_='table--narrow')
    
    if problems_table is None:
        print("⚠️ Ostrzeżenie: Nie znaleziono głównej tabeli z zadaniami (klasa 'table--narrow').")
        return []

    # Iterujemy po wierszach (<tr>) w ciele tabeli (<tbody>)
    # Znajdujemy wszystkie wiersze, które nie są nagłówkami grup
    for row in problems_table.find('tbody').find_all('tr'):
        # Pomijamy wiersze nagłówków grup
        if 'problemlist-subheader' in row.get('class', []):
            continue
            
        # Pamiętamy: każda poprawna linia zadania ma 6 komórek <td> (short name, name, tries, score, empty, submit)
        cells = row.find_all('td', recursive=False)
        
        if len(cells) >= 2:
            # 1. Short Name jest w pierwszej komórce
            short_name = cells[0].get_text().strip()
            
            # 2. Pełna Nazwa jest tekstem wewnątrz znacznika <a> w drugiej komórce
            full_name_element = cells[1].find('a')
            
            full_name = "Brak nazwy"
            if full_name_element:
                full_name = full_name_element.get_text().strip()

            if short_name and full_name != "Brak nazwy":
                problem_list.append({
                    "short_name": short_name,
                    "full_name": full_name
                })
                
    return problem_list

def zapisz_do_json(dane: List[Dict[str, str]], plik_json: str):
    """
    Zapisuje listę słowników do pliku JSON, zastępując jego zawartość.
    """
    print(f"2. Zapisywanie {len(dane)} problemów do pliku: {plik_json}...")
    try:
        # 'w' zapewnia, że zawartość pliku zostanie zastąpiona
        with open(plik_json, 'w', encoding='utf-8') as f:
            # Używamy indent=4 dla czytelności JSON
            json.dump(dane, f, ensure_ascii=False, indent=4)
        print(f"✅ Sukces! Dane problemów zapisane w pliku '{plik_json}'.")
    except Exception as e:
        print(f"❌ Błąd zapisu do pliku JSON: {e}")

# -----------------------------------------------------
# GŁÓWNA LOGIKA SKRYPTU
# -----------------------------------------------------
if __name__ == "__main__":
    
    # 1. Pobierz dane problemów
    problems_data = pobierz_problemy(PLIK_WEJSCIOWY)
    
    if problems_data:
        # 2. Zapisz do JSON
        zapisz_do_json(problems_data, PLIK_WYJSCIOWY)
    else:
        print("🛑 Proces zakończony: Nie znaleziono żadnych zadań do zapisania.")