Rzemieślnik inc.
===========================

Opis
-----
Narzędzie do obsługi systemów OIOIOI poprzez API i tokeny użytkowników.

Strona projektu: https://github.com/Gdylf/rzemieslnik-oioioi-api-tool

Licencja
--------
Projekt udostępniony na licencji GPL-3.0.

Wymagania
---------
- Python 3.x
- Zainstalowane biblioteki:<br/>
  -concurrent<br/>
  -datetime<br/>
  -flask<br/>
  -flask_cors<br/>
  -json<br/>
  -os<br/>
  -pyautogui<br/>
  -pyperclip<br/>
  -requests<br/>
  -short_name_fetcher<br/>
  -sys<br/>
  -threading<br/>
  -time<br/>
  -tkinter<br/>
  -webbrowser<br/>


Instalacja
-----------
1. Sklonuj repozytorium:
```
   git clone https://github.com/Gdylf/rzemieslnik-oioioi-api-tool.git
```
2. Przejdź do katalogu projektu:
```
   cd rzemieslnik-oioioi-api-tool
```
3. (Opcjonalnie) Utwórz i aktywuj wirtualne środowisko:
```
   python -m venv venv
   .\venv\Scripts\activate
```
4. Zainstaluj wymagane biblioteki:
```
   pip install -r requirements.txt
```
Użycie Serwera
-------
1. Aby uruchomić serwer należy uruchomić aplikację:
```
   python __app.py
```
2. Następnie wystarczy otworzyć *localhost:4000* w przeglądarce


Użycie Pobieracza Problemów
-------
1. Aby uruchomić serwer należy uruchomić aplikację:
   __pobieracz problemów.exe dla komputerów z systemem windows, albo
   __pobieracz problemów.py dla komputerów z zainstalowanym pythonem.

2. Następnie wystarczy ustawić opcje generowania i kliknąć run.
   Plik powinien problemy.json powinien się zapisać w tym samym katalogu.


Flagi Opcjonalne
-------
1. `--port`
 manualna zmiana portu dla jednego ranu np. `--port 2137` ustawi port na 2137

2. `--target`
 zmiana celu dla api np.`--target https://szkopul.edu.pl` zmienia cel dla api na szkopuł

CLI (WIP)
-------
 Wersja CLI Rzemieślik inc. która wymaga tylko pobranego pythona (brak wymagań paczek)

### 1.Lista komend
 1. `check_token`

 2. `single_submit`
 
 3. `multi_submit`
 
 4. `spam`

## 2.Globalne Flagi (Przed Subkomendą)
1. `--target`

    zmiana celu dla api np.`--target https://szkopul.edu.pl` zmienia cel dla api na szkopuł
2. `--token`

    token użyty do wysyłania zadania/ sprawdziania nazwy użytkownika
### 3.Flagi subkomend wysyłania kodu (Po subkomendzie)
1. `--contest`

   Na który kontest wysłać submity

2. `--problem`(single_submit)

   Na które zadania wysłać submita

3. `--problems` (multi_submit & spam)

   Na które zadania wysłać submity (zadania po przecinku i bez spacji)

4. `--repeat`

   Powtórzenia wysyłania kodu

5. `--concurency`

   Ile wątków do użycia przy wysyłaniu kodu

6. `--code` (single_submit & multi_submit)

   Śczieżka do kodu do wysłania

