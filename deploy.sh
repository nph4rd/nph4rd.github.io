ipfs daemon > ipfs.log &
sleep 5
currentDate=`date`
sed -i '$d' ipfs.html
echo "<hr>" >> ipfs.html
echo $currentDate >> ipfs.html
ipfs add --ignore-rules-path=.ipfsignore -r . >> tmp_hashes.txt
sed -i -e 's/added/<br>added/g' tmp_hashes.txt
cat tmp_hashes.txt >> ipfs.html
rm tmp_hashes.txt
echo "</html>" >> ipfs.html
git add -A
git commit -a -m 'Update ipfs hashes'
git push origin master

