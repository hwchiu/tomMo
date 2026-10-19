package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"fpm/internal/impex"
	"fpm/internal/safeio"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "import":
		os.Exit(runImport(os.Args[2:]))
	case "export":
		os.Exit(runExport(os.Args[2:]))
	case "fixture":
		os.Exit(runFixture(os.Args[2:]))
	case "-h", "--help", "help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "未知指令 %s\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, `用法：
  fpmctl import --dir DIR | --xlsx FILE [--base URL] [--user USER] [--password PWD] [--dry-run]
  fpmctl export --dir DIR | --xlsx FILE [--base URL] [--user USER] [--password PWD]
  fpmctl fixture -out FILE

密碼用 --password 或環境變數 FPM_PASSWORD。
匯入以名稱做冪等更新，不會刪除檔案裡沒有的列。
`)
}

func runImport(args []string) int {
	fs := flag.NewFlagSet("import", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	base := fs.String("base", "http://127.0.0.1:8080", "服務位址")
	user := fs.String("user", "admin", "編輯者帳號")
	password := fs.String("password", os.Getenv("FPM_PASSWORD"), "密碼")
	dir := fs.String("dir", "", "CSV 目錄")
	xlsx := fs.String("xlsx", "", "xlsx 檔")
	dry := fs.Bool("dry-run", false, "只顯示會建立或更新的列")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	files, report, err := readInput(*dir, *xlsx)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	if len(report.Errors) > 0 {
		fmt.Print(report.Text(*dry))
		return 1
	}
	if *password == "" {
		fmt.Fprintln(os.Stderr, "請用 --password 或 FPM_PASSWORD 提供密碼")
		return 2
	}
	report, err = impex.ImportRemote(context.Background(), *base, *user, *password, files, *dry)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Print(report.Text(*dry))
	if len(report.Errors) > 0 {
		return 1
	}
	return 0
}

func runExport(args []string) int {
	fs := flag.NewFlagSet("export", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	base := fs.String("base", "http://127.0.0.1:8080", "服務位址")
	user := fs.String("user", "admin", "帳號")
	password := fs.String("password", os.Getenv("FPM_PASSWORD"), "密碼")
	dir := fs.String("dir", "", "輸出目錄")
	xlsx := fs.String("xlsx", "", "輸出 xlsx")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if (*dir == "") == (*xlsx == "") {
		fmt.Fprintln(os.Stderr, "請指定 --dir 或 --xlsx 其中一個")
		return 2
	}
	if *password == "" {
		fmt.Fprintln(os.Stderr, "請用 --password 或 FPM_PASSWORD 提供密碼")
		return 2
	}
	files, err := impex.ExportRemote(context.Background(), *base, *user, *password)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if *xlsx != "" {
		raw, err := impex.WriteXLSX(files)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		if err := safeio.WriteFile(*xlsx, raw); err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		fmt.Printf("已寫出 %s\n", *xlsx)
		return 0
	}
	if err := impex.WriteDir(*dir, files); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Printf("已寫出 %s\n", *dir)
	return 0
}

func runFixture(args []string) int {
	fs := flag.NewFlagSet("fixture", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	out := fs.String("out", "", "輸出的 demo.json")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *out == "" {
		fmt.Fprintln(os.Stderr, "請指定 -out")
		return 2
	}
	db, err := impex.LoadDemo()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	raw, err := json.Marshal(db)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if err := safeio.WriteFile(*out, raw); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Printf("已寫出 %s\n", *out)
	return 0
}

func readInput(dir, xlsx string) (map[string]string, impex.Report, error) {
	if (dir == "") == (xlsx == "") {
		return nil, impex.Report{}, fmt.Errorf("請指定 --dir 或 --xlsx 其中一個")
	}
	if dir != "" {
		files, err := impex.ReadDir(dir)
		if err != nil {
			return nil, impex.Report{}, err
		}
		_, report := impex.ParseFiles(files)
		return files, report, nil
	}
	raw, err := safeio.ReadFile(xlsx)
	if err != nil {
		return nil, impex.Report{}, err
	}
	files, report := impex.XLSXFiles(strings.NewReader(string(raw)))
	if len(report.Errors) > 0 {
		return nil, report, nil
	}
	_, parsed := impex.ParseFiles(files)
	return files, parsed, nil
}
