import tkinter as tk
from tkinter import ttk, messagebox
import webbrowser
import pyautogui
import time
import pyperclip
import threading
import sys
import os
import json # Dodano do obsługi plików JSON
import short_name_fetcher as futa
# -----------------------------------------------------
# KONFIGURACJA GŁÓWNA
# -----------------------------------------------------
# Stałe dla domyślnych wartości i ścieżki
# Adres URL jest budowany dynamicznie z wybranego skrótu konkursu
BASE_URL_FORMAT = "https://wyzwania.programuj.edu.pl/c/{}/p"
CONTEST_FILE_PATH = "contesty.json"
DEFAULT_CONTESTS = ["29wieloryby", "2509pomorzanka"]
DOMYŚLNA_NAZWA_PLIKU = "wyzw.html" # Stała nazwa pliku wyjściowego
DOMYŚLNE_OPÓŹNIENIE_P = 3.0 # Stałe opóźnienie początkowe
DOMYŚLNE_OPÓŹNIENIE_M = 0.5 # Stałe opóźnienie między krokami

def load_contests():
    """Wczytuje listę konkursów z pliku JSON lub zwraca domyślną listę."""
    try:
        with open(CONTEST_FILE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Upewnienie się, że wczytana struktura to lista stringów
            if isinstance(data, list) and all(isinstance(item, str) for item in data):
                return data
            return DEFAULT_CONTESTS
    except (FileNotFoundError, json.JSONDecodeError):
        # Jeśli plik nie istnieje lub jest uszkodzony, zapisz domyślne dane i je zwróć
        save_contests(DEFAULT_CONTESTS)
        return DEFAULT_CONTESTS
    except Exception:
        # W przypadku innych błędów, zwraca domyślne
        return DEFAULT_CONTESTS

def save_contests(contests):
    """Zapisuje listę konkursów do pliku JSON."""
    try:
        with open(CONTEST_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(contests, f, indent=4)
        return True
    except Exception as e:
        print(f"BŁĄD ZAPISU JSON: Nie udało się zapisać listy konkursów: {e}")
        return False

class SourceCodeDownloaderApp:
    def __init__(self, master):
        self.master = master
        master.title("Automatyczny Patcher Kodu Źródłowego (Konkursy)")
        master.geometry("650x550")
        
        # Wczytanie początkowej listy konkursów
        self.contests = load_contests()

        # Stylizacja
        style = ttk.Style()
        style.configure("TButton", font=("Inter", 10), padding=6)
        style.configure("TLabel", font=("Inter", 10))
        style.configure("TEntry", font=("Inter", 10))
        style.configure("TLabelframe.Label", font=("Inter", 11, "bold"))

        # Zmiana stylu przycisku na czarny tekst
        style.configure("Run.TButton", font=("Inter", 12, "bold"), foreground="black", background="#4CAF50")
        style.map("Run.TButton", background=[('active', '#66BB6A')])

        # Zmienna do śledzenia statusu wątku
        self.is_running = False

        # Zmienne kontrolne Tkinter
        self.contest_var = tk.StringVar()
        if self.contests:
            self.contest_var.set(self.contests[0]) # Ustawienie pierwszego konkursu jako domyślnego
        
        self.new_contest_var = tk.StringVar()

        # --- Tworzenie Interfejsu ---
        main_frame = ttk.Frame(master, padding="15 15 15 15")
        main_frame.pack(fill='both', expand=True)

        # 1. Sekcja Wyboru Konkursu (Labelframe)
        self._create_contest_selection_ui(main_frame)

        # 2. Przycisk Uruchom
        self.run_button = ttk.Button(main_frame, text="🚀 Uruchom Pobieranie (Nie dotykaj myszy!)", 
                                     command=self._start_automation_thread, style="Run.TButton")
        self.run_button.pack(fill='x', pady=15)
        
        # 3. Sekcja Zarządzania Konkursami (Labelframe)
        self._create_contest_management_ui(main_frame)

        # 4. Sekcja Logów (Labelframe)
        log_frame = ttk.LabelFrame(main_frame, text="Dziennik Działania", padding="10 10 10 10")
        log_frame.pack(fill='both', expand=True, pady=(10, 0))

        # Pole tekstowe dla logów
        self.log_area = tk.Text(log_frame, height=15, state='disabled', font=("Courier", 9), relief=tk.SUNKEN, bd=2, wrap='word')
        self.log_area.pack(fill='both', expand=True)

        # Tagi do kolorowania logów
        self.log_area.tag_config('success', foreground='green4')
        self.log_area.tag_config('error', foreground='red4', font=("Courier", 9, "bold"))
        self.log_area.tag_config('warning', foreground='orange4')
        self.log_area.tag_config('info', foreground='blue4')

        self.log_message(f"Aplikacja gotowa. Wczytano {len(self.contests)} konkursów z pliku {CONTEST_FILE_PATH}.", 'info')
        self.log_message("!!! UWAGA: Upewnij się, że okno terminala/aplikacji jest na pierwszym planie po kliknięciu 'Uruchom' i NIE dotykaj myszy/klawiatury podczas działania skryptu.", 'warning')

    def _create_contest_selection_ui(self, parent):
        """Tworzy sekcję wyboru konkursu za pomocą ComboBox."""
        select_frame = ttk.LabelFrame(parent, text="Wybór Konkursu", padding="10")
        select_frame.pack(fill='x', pady=10)

        label = ttk.Label(select_frame, text="Skrócona nazwa konkursu:")
        label.grid(row=0, column=0, sticky='w', padx=5, pady=5)
        
        self.contest_dropdown = ttk.Combobox(
            select_frame, 
            textvariable=self.contest_var, 
            values=self.contests,
            state='readonly',
            width=57
        )
        self.contest_dropdown.grid(row=0, column=1, sticky='ew', padx=5, pady=5)
        
        # Upewnienie się, że kolumna 1 jest rozciągliwa
        select_frame.grid_columnconfigure(1, weight=1)

    def _create_contest_management_ui(self, parent):
        """Tworzy sekcję zarządzania konkursami (dodawanie/usuwanie)."""
        manage_frame = ttk.LabelFrame(parent, text="Zarządzanie Konkursami", padding="10")
        manage_frame.pack(fill='x', pady=10)

        # Pole wejściowe dla nowej nazwy
        label = ttk.Label(manage_frame, text="Dodaj/usuń konkurs (np. 30karp):")
        label.grid(row=0, column=0, sticky='w', padx=5, pady=5)
        
        entry = ttk.Entry(manage_frame, textvariable=self.new_contest_var, width=30)
        entry.grid(row=0, column=1, sticky='ew', padx=5, pady=5)
        
        # Przyciski
        add_button = ttk.Button(manage_frame, text="➕ Dodaj", command=self.add_contest)
        add_button.grid(row=0, column=2, padx=5, pady=5)

        delete_button = ttk.Button(manage_frame, text="🗑️ Usuń Wybrany", command=self.delete_selected_contest)
        delete_button.grid(row=0, column=3, padx=5, pady=5)
        
        # Upewnienie się, że kolumna 1 jest rozciągliwa
        manage_frame.grid_columnconfigure(1, weight=1)

    def add_contest(self):
        """Dodaje nową nazwę konkursu do listy i pliku JSON."""
        new_contest = self.new_contest_var.get().strip()
        if not new_contest:
            messagebox.showerror("Błąd", "Wprowadź skróconą nazwę konkursu do dodania.")
            return

        if new_contest in self.contests:
            messagebox.showwarning("Informacja", f"Konkurs '{new_contest}' jest już na liście.")
            return
            
        self.contests.append(new_contest)
        self.contests.sort() # Sortowanie alfabetyczne
        
        if save_contests(self.contests):
            self.contest_dropdown['values'] = self.contests
            self.contest_var.set(new_contest)
            self.new_contest_var.set("")
            self.log_message(f"✅ Dodano nowy konkurs: '{new_contest}'. Lista zapisana.", 'success')
        else:
            self.log_message("❌ Błąd zapisu: Nie udało się zaktualizować pliku JSON.", 'error')


    def delete_selected_contest(self):
        """Usuwa aktualnie wybraną nazwę konkursu z listy i pliku JSON."""
        selected_contest = self.contest_var.get()
        
        if not selected_contest:
            messagebox.showerror("Błąd", "Nie wybrano żadnego konkursu do usunięcia.")
            return

        if selected_contest not in self.contests:
            messagebox.showerror("Błąd", f"Konkurs '{selected_contest}' nie znajduje się na liście.")
            return

        # Potwierdzenie usunięcia (w Tkinterze)
        if not messagebox.askyesno("Potwierdzenie", f"Czy na pewno chcesz usunąć konkurs '{selected_contest}'?"):
            return
            
        try:
            self.contests.remove(selected_contest)
            
            if save_contests(self.contests):
                self.contest_dropdown['values'] = self.contests
                if self.contests:
                    # Ustawienie pierwszego elementu jako nowego wybranego, lub czyszczenie
                    self.contest_var.set(self.contests[0])
                else:
                    self.contest_var.set("")
                    
                self.log_message(f"✅ Usunięto konkurs: '{selected_contest}'. Lista zapisana.", 'success')
            else:
                self.contests.append(selected_contest) # Przywrócenie w przypadku błędu zapisu
                self.log_message("❌ Błąd zapisu: Nie udało się zaktualizować pliku JSON. Nie usunięto konkursu.", 'error')

        except ValueError:
            self.log_message(f"Wewnętrzny błąd: Konkurs '{selected_contest}' nie znaleziono na liście Python.", 'error')


    def log_message(self, message, tag=None):
        """Wątkowo bezpieczna metoda do aktualizacji pola logów."""
        self.master.after(0, self._append_to_log, message, tag)

    def _append_to_log(self, message, tag):
        """Faktyczna funkcja aktualizująca logi (wywoływana przez główny wątek)."""
        self.log_area.config(state='normal')
        self.log_area.insert('end', f"{time.strftime('%H:%M:%S')} - {message}\n", tag)
        self.log_area.see('end')
        self.log_area.config(state='disabled')

    def _validate_inputs(self):
        """Walidacja danych wejściowych (tylko wybór konkursu)."""
        if not self.contest_var.get().strip():
            messagebox.showerror("Błąd Walidacji", "Musisz wybrać konkurs z listy.")
            return False
        return True

    def _set_gui_running(self, running):
        """Aktualizacja stanu GUI (przycisk/status) w głównym wątku."""
        self.is_running = running
        state = 'disabled' if running else 'normal'
        self.run_button.config(state=state)
        self.run_button.config(text="PRACUJE... Nie dotykaj!" if running else "🚀 Uruchom Pobieranie (Nie dotykaj myszy!)")
        
        # Wyłączanie kontrolek zarządzania podczas automatyzacji
        self.contest_dropdown.config(state='readonly' if not running else 'disabled')

    def _start_automation_thread(self):
        """Inicjuje wątek do uruchomienia automatyzacji."""
        if not self._validate_inputs() or self.is_running:
            return

        self._set_gui_running(True)
        self.log_area.config(state='normal')
        self.log_area.delete('1.0', 'end')
        self.log_area.config(state='disabled')

        # Pobieranie wybranego konkursu
        contest_name = self.contest_var.get().strip()
        url = BASE_URL_FORMAT.format(contest_name)
        
        # Użycie stałych opóźnień i nazwy pliku
        opoznienie_p = DOMYŚLNE_OPÓŹNIENIE_P
        opoznienie_m = DOMYŚLNE_OPÓŹNIENIE_M
        nazwa_pliku = DOMYŚLNA_NAZWA_PLIKU

        # Uruchomienie głównej logiki w osobnym wątku
        automation_thread = threading.Thread(
            target=self.pobierz_kod_zrodlowy_automatyzacja, 
            args=(url, nazwa_pliku, opoznienie_p, opoznienie_m)
        )
        automation_thread.start()


    def pobierz_kod_zrodlowy_automatyzacja(self, url, nazwa_pliku, opoznienie_p, opoznienie_m):
        """
        Otwiera URL w przeglądarce, symuluje skróty Ctrl+U, Ctrl+A, Ctrl+C,
        a następnie zapisuje schowek do pliku.
        Metoda uruchamiana w osobnym wątku!
        """
        try:
            self.log_message(f"1. Otwieranie strony: {url} w domyślnej przeglądarce...", 'info')
            webbrowser.open_new_tab(url)
            
            # Czekamy, aż przeglądarka się wczyta i znajdzie się na pierwszym planie
            self.log_message(f"Czekam {opoznienie_p}s na załadowanie przeglądarki...", 'warning')
            time.sleep(opoznienie_p) 

            # Krok 1: Otwórz kod źródłowy (Ctrl + U)
            self.log_message("2. Naciskanie: Ctrl + U (Otwarcie źródła strony)")
            pyautogui.hotkey('ctrl', 'u')
            time.sleep(opoznienie_m)

            # Czekamy, aż nowa karta z kodem źródłowym się wczyta i znajdzie na pierwszym planie
            self.log_message(f"Czekam {opoznienie_p}s na załadowanie źródła strony...", 'warning')
            time.sleep(opoznienie_p)
            
            # Krok 2: Zaznacz wszystko (Ctrl + A)
            self.log_message("3. Naciskanie: Ctrl + A (Zaznacz wszystko)")
            pyautogui.hotkey('ctrl', 'a')
            time.sleep(opoznienie_m)

            # Krok 3: Kopiuj (Ctrl + C)
            self.log_message("4. Naciskanie: Ctrl + C (Kopiowanie do schowka)")
            pyautogui.hotkey('ctrl', 'c')
            time.sleep(opoznienie_m)

            # Krok 4: Zamknij kartę/okno (Ctrl + W) - zamknięcie aktywnego okna kodu źródłowego
            self.log_message("5. Naciskanie: Ctrl + W (Zamknięcie aktywnej karty/okna)")
            pyautogui.hotkey('ctrl', 'w')
            time.sleep(opoznienie_m)
            # Drugie Ctrl+W, aby zamknąć oryginalną kartę (w zależności od przeglądarki)
            self.log_message("   Naciskanie Ctrl + W ponownie (zamykanie oryginalnej karty)")
            pyautogui.hotkey('ctrl', 'w')
            time.sleep(opoznienie_m)

            # Krok 5: Odczytaj schowek
            self.log_message("6. Odczytywanie danych ze schowka...")
            try:
                skopiowana_zawartosc = pyperclip.paste()
            except pyperclip.PyperclipException:
                self.log_message("❌ BŁĄD: Nie można uzyskać dostępu do schowka. Upewnij się, że pyperclip jest zainstalowany i działa w Twoim systemie.", 'error')
                return

            if not skopiowana_zawartosc:
                self.log_message("\n❌ BŁĄD: Schowek jest pusty. Sprawdź, czy okna przeglądarki zdążyły się wczytać lub zwiększ opóźnienia.", 'error')
                return

            # Krok 6: Zapisz do pliku
            self.log_message(f"7. Zapisywanie zawartości do pliku: {nazwa_pliku}...")
            with open(nazwa_pliku, 'w', encoding='utf-8') as f:
                f.write(skopiowana_zawartosc)
            problems_data = futa.pobierz_problemy(futa.PLIK_WEJSCIOWY)
                
            if problems_data:
                    # 2. Zapisz do JSON
                futa.zapisz_do_json(problems_data, futa.PLIK_WYJSCIOWY)
            else:
                print("🛑 Proces zakończony: Nie znaleziono żadnych zadań do zapisania.")
            self.log_message(f"\n✅ Sukces! Kod źródłowy ({len(skopiowana_zawartosc)} znaków) zapisano w pliku: {os.path.abspath(nazwa_pliku)}", 'success')
            
            # Usunięto blok futa.pobierz_problemy, ponieważ moduł nie został dostarczony
            self.log_message("Pomijam dodatkowe przetwarzanie: Moduł 'short_name_fetcher' nie jest zdefiniowany.", 'warning')

        except pyautogui.FailSafeException:
            self.log_message("\n🛑 PRZERWANO: Wykryto FailSafe (przesunięcie kursora myszy do lewego górnego rogu). Automatyzacja zatrzymana.", 'error')
        except Exception as e:
            self.log_message(f"\n❌ Wystąpił nieoczekiwany błąd: {e}", 'error')
            self.log_message("Wskazówka: Upewnij się, że przeglądarka jest domyślnie skonfigurowana i wszystkie wymagane biblioteki są zainstalowane.", 'error')
        finally:
            self._set_gui_running(False)


if __name__ == "__main__":
    try:
        pass 
    except ImportError:
        messagebox.showerror("Brak Wymaganych Bibliotek", 
                             "Brak wymaganej biblioteki 'pyautogui' lub 'pyperclip'.\n"
                             "Użyj komendy: pip install pyautogui pyperclip")
        sys.exit(1)
        
    root = tk.Tk()
    app = SourceCodeDownloaderApp(root)
    root.mainloop()
