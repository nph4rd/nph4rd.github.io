ipfs daemon > ipfs.log &
sleep 5
currentDate=`date`
sed -i '$d' ipfs.html
echo "<hr>" >> ipfs.html
echo $currentDate >> ipfs.html
ipfs add --ignore-rules-path=.ipfsignore -r . >> ipfs.html
echo "</html>" >> ipfs.html
git add -A
git commit -a -m 'Update ipfs hashes'
git push origin master

