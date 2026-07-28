# EPUB 빌드

이 저장소는 PDF판과 같은 Markdown 원본을 사용해 한국어와 영어 EPUB 3 전자책을 생성한다.

[Pandoc](https://pandoc.org/), Poppler의 `pdftoppm`, 선택 사항인
[EPUBCheck](https://www.w3.org/publishing/epubcheck/)를 설치해야 한다. 빌드 스크립트는
각 언어 PDF의 첫 페이지를 EPUB 표지로 사용하므로 PDF를 먼저 생성해야 한다.
EPUBCheck가 설치되어 있으면 생성한 파일을 자동으로 검증한다.

저장소 루트에서 두 언어를 모두 빌드한다.

```bash
./build_epub.sh
```

한 언어만 빌드하려면 언어 코드를 지정한다.

```bash
./build_epub.sh ko
./build_epub.sh en
```

생성된 `.epub` 파일은 각 언어의 책 디렉터리에 저장되며 Git 추적에서는 제외된다.
